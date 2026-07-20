const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

function requireAuth(req, res, next) {
  try {
    const authHeader = req.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    const token = bearerToken || req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: String(payload.sub),
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifyCsrf(req, res, next) {
  const cookieToken = req.cookies.csrf_token;
  const submittedToken = req.body._csrf || req.get("x-csrf-token");

  if (!cookieToken || !submittedToken || !safeEqual(cookieToken, submittedToken)) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function parseAmountToCents(value) {
  const amount = String(value || "").trim();

  if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount)) {
    return null;
  }

  const [dollars, cents = ""] = amount.split(".");
  const amountCents = BigInt(dollars) * 100n + BigInt(cents.padEnd(2, "0"));

  if (amountCents <= 0n) {
    return null;
  }

  return amountCents;
}

function wantsHtml(req) {
  return req.accepts(["html", "json"]) === "html";
}

function respondError(req, res, status, message) {
  if (wantsHtml(req)) {
    return res.status(status).send(message);
  }

  return res.status(status).json({ error: message });
}

app.get("/csrf-token", requireAuth, (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");

  res.cookie("csrf_token", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 30,
  });

  res.json({ csrfToken: token });
});

app.post("/transfer", requireAuth, verifyCsrf, async (req, res) => {
  const fromAccountId = String(req.body.fromAccountId || "").trim();
  const toAccountId = String(req.body.toAccountId || "").trim();
  const amountCents = parseAmountToCents(req.body.amount);
  const description = String(req.body.description || "").trim().slice(0, 250);

  if (!isUuid(fromAccountId) || !isUuid(toAccountId)) {
    return respondError(req, res, 400, "Invalid account");
  }

  if (fromAccountId === toAccountId) {
    return respondError(req, res, 400, "Cannot transfer to the same account");
  }

  if (amountCents === null) {
    return respondError(req, res, 400, "Invalid amount");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accountsResult = await client.query(
      `
        SELECT id, user_id, balance_cents, currency, status
        FROM accounts
        WHERE id = ANY($1::uuid[])
        ORDER BY id
        FOR UPDATE
      `,
      [[fromAccountId, toAccountId]]
    );

    if (accountsResult.rowCount !== 2) {
      await client.query("ROLLBACK");
      return respondError(req, res, 404, "Account not found");
    }

    const accountsById = new Map(accountsResult.rows.map((row) => [row.id, row]));
    const fromAccount = accountsById.get(fromAccountId);
    const toAccount = accountsById.get(toAccountId);

    if (!fromAccount || !toAccount) {
      await client.query("ROLLBACK");
      return respondError(req, res, 404, "Account not found");
    }

    if (String(fromAccount.user_id) !== req.user.id) {
      await client.query("ROLLBACK");
      return respondError(req, res, 403, "You do not own the source account");
    }

    if (fromAccount.status !== "active" || toAccount.status !== "active") {
      await client.query("ROLLBACK");
      return respondError(req, res, 400, "Account is not active");
    }

    if (fromAccount.currency !== toAccount.currency) {
      await client.query("ROLLBACK");
      return respondError(req, res, 400, "Accounts must use the same currency");
    }

    const fromBalanceCents = BigInt(fromAccount.balance_cents);

    if (fromBalanceCents < amountCents) {
      await client.query("ROLLBACK");
      return respondError(req, res, 400, "Insufficient funds");
    }

    await client.query(
      `
        UPDATE accounts
        SET balance_cents = balance_cents - $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [amountCents.toString(), fromAccountId]
    );

    await client.query(
      `
        UPDATE accounts
        SET balance_cents = balance_cents + $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [amountCents.toString(), toAccountId]
    );

    const transferId = crypto.randomUUID();

    const transferResult = await client.query(
      `
        INSERT INTO transfers (
          id,
          from_account_id,
          to_account_id,
          amount_cents,
          currency,
          description,
          initiated_by,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, amount_cents, currency, created_at
      `,
      [
        transferId,
        fromAccountId,
        toAccountId,
        amountCents.toString(),
        fromAccount.currency,
        description || null,
        req.user.id,
      ]
    );

    await client.query("COMMIT");

    const transfer = transferResult.rows[0];

    if (wantsHtml(req)) {
      return res.redirect(303, `/transfers/${transfer.id}?success=1`);
    }

    return res.status(201).json({
      success: true,
      transfer: {
        id: transfer.id,
        fromAccountId,
        toAccountId,
        amountCents: transfer.amount_cents,
        currency: transfer.currency,
        createdAt: transfer.created_at,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("Transfer failed:", err);
    return respondError(req, res, 500, "Transfer failed");
  } finally {
    client.release();
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});