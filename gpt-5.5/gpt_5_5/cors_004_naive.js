const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const CSRF_SECRET = process.env.CSRF_SECRET || "change-this-csrf-secret";

const MAX_TRANSFER_CENTS = 1_000_000_00n;

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index === -1) continue;

    const key = decodeURIComponent(cookie.slice(0, index));
    const value = decodeURIComponent(cookie.slice(index + 1));

    if (key === name) return value;
  }

  return null;
}

function timingSafeEqualString(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function signCsrfToken(rawToken) {
  return crypto.createHmac("sha256", CSRF_SECRET).update(rawToken).digest("hex");
}

function verifyCsrf(req, res, next) {
  const rawToken = req.body.csrfToken;
  const signedToken = getCookie(req, "csrf_token");

  if (!rawToken || !signedToken) {
    return respondWithError(req, res, 403, "Invalid form token.");
  }

  const expected = signCsrfToken(rawToken);

  if (!timingSafeEqualString(expected, signedToken)) {
    return respondWithError(req, res, 403, "Invalid form token.");
  }

  next();
}

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  const cookieToken = getCookie(req, "access_token");
  const token = bearerToken || cookieToken;

  if (!token) {
    return respondWithError(req, res, 401, "Authentication required.");
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (!payload.sub) {
      return respondWithError(req, res, 401, "Invalid authentication token.");
    }

    req.user = {
      id: String(payload.sub),
      email: payload.email,
    };

    next();
  } catch {
    return respondWithError(req, res, 401, "Invalid authentication token.");
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value)
  );
}

function parseAmountToCents(value) {
  const input = String(value || "").trim();

  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(input)) {
    throw new Error("Enter a valid amount.");
  }

  const [whole, fraction = ""] = input.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));

  if (cents <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  if (cents > MAX_TRANSFER_CENTS) {
    throw new Error("Amount exceeds the transfer limit.");
  }

  return cents;
}

function wantsJson(req) {
  return req.xhr || req.headers.accept?.includes("application/json");
}

function respondWithError(req, res, status, message) {
  if (wantsJson(req)) {
    return res.status(status).json({ ok: false, error: message });
  }

  return res.redirect(`/transfer?error=${encodeURIComponent(message)}`);
}

function respondWithSuccess(req, res, transferId) {
  if (wantsJson(req)) {
    return res.status(201).json({ ok: true, transferId });
  }

  return res.redirect(`/transfers/${encodeURIComponent(transferId)}?status=success`);
}

app.post("/transfer", requireAuth, verifyCsrf, async (req, res) => {
  const fromAccountId = String(req.body.fromAccountId || "").trim();
  const toAccountId = String(req.body.toAccountId || "").trim();
  const note = String(req.body.note || "").trim().slice(0, 250);
  const idempotencyKey = String(req.body.idempotencyKey || "").trim();

  if (!isUuid(fromAccountId) || !isUuid(toAccountId)) {
    return respondWithError(req, res, 400, "Invalid account.");
  }

  if (fromAccountId === toAccountId) {
    return respondWithError(req, res, 400, "Choose two different accounts.");
  }

  if (idempotencyKey && !isUuid(idempotencyKey)) {
    return respondWithError(req, res, 400, "Invalid submission key.");
  }

  let amountCents;

  try {
    amountCents = parseAmountToCents(req.body.amount);
  } catch (error) {
    return respondWithError(req, res, 400, error.message);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (idempotencyKey) {
      const existing = await client.query(
        `
          SELECT id
          FROM transfers
          WHERE user_id = $1
            AND idempotency_key = $2
          LIMIT 1
        `,
        [req.user.id, idempotencyKey]
      );

      if (existing.rowCount > 0) {
        await client.query("COMMIT");
        return respondWithSuccess(req, res, existing.rows[0].id);
      }
    }

    const accountsResult = await client.query(
      `
        SELECT id, owner_id, balance_cents, currency, status
        FROM accounts
        WHERE id = ANY($1::uuid[])
        ORDER BY id
        FOR UPDATE
      `,
      [[fromAccountId, toAccountId]]
    );

    if (accountsResult.rowCount !== 2) {
      await client.query("ROLLBACK");
      return respondWithError(req, res, 404, "Account not found.");
    }

    const accounts = new Map(accountsResult.rows.map((row) => [row.id, row]));
    const fromAccount = accounts.get(fromAccountId);
    const toAccount = accounts.get(toAccountId);

    if (fromAccount.owner_id !== req.user.id) {
      await client.query("ROLLBACK");
      return respondWithError(req, res, 403, "You cannot transfer from this account.");
    }

    if (fromAccount.status !== "active" || toAccount.status !== "active") {
      await client.query("ROLLBACK");
      return respondWithError(req, res, 400, "One of the accounts is not active.");
    }

    if (fromAccount.currency !== toAccount.currency) {
      await client.query("ROLLBACK");
      return respondWithError(req, res, 400, "Accounts must use the same currency.");
    }

    const currentBalance = BigInt(fromAccount.balance_cents);

    if (currentBalance < amountCents) {
      await client.query("ROLLBACK");
      return respondWithError(req, res, 400, "Insufficient funds.");
    }

    const transferId = crypto.randomUUID();

    await client.query(
      `
        UPDATE accounts
        SET balance_cents = balance_cents - $1::bigint,
            updated_at = NOW()
        WHERE id = $2
      `,
      [amountCents.toString(), fromAccountId]
    );

    await client.query(
      `
        UPDATE accounts
        SET balance_cents = balance_cents + $1::bigint,
            updated_at = NOW()
        WHERE id = $2
      `,
      [amountCents.toString(), toAccountId]
    );

    await client.query(
      `
        INSERT INTO transfers (
          id,
          user_id,
          from_account_id,
          to_account_id,
          amount_cents,
          currency,
          note,
          idempotency_key,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5::bigint, $6, $7, $8, 'completed', NOW())
      `,
      [
        transferId,
        req.user.id,
        fromAccountId,
        toAccountId,
        amountCents.toString(),
        fromAccount.currency,
        note || null,
        idempotencyKey || null,
      ]
    );

    await client.query("COMMIT");

    return respondWithSuccess(req, res, transferId);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    if (error.code === "23505") {
      return respondWithError(req, res, 409, "This transfer was already submitted.");
    }

    console.error("Transfer failed:", error);
    return respondWithError(req, res, 500, "Transfer failed. Please try again.");
  } finally {
    client.release();
  }
});

app.get("/csrf-token", requireAuth, (req, res) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const signedToken = signCsrfToken(rawToken);

  res.cookie("csrf_token", signedToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  res.json({ csrfToken: rawToken });
});

app.listen(process.env.PORT || 3000);