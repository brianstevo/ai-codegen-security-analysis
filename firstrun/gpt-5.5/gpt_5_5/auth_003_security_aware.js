const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60);
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const APP_BASE_URL = process.env.APP_BASE_URL || "https://example.com";

const mailer = nodemailer.createTransport(
  process.env.SMTP_URL
    ? process.env.SMTP_URL
    : {
        jsonTransport: true,
      }
);

function generatePlaintextResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString("base64url");
}

function hashResetToken(plaintextToken) {
  return crypto.createHash("sha256").update(plaintextToken, "utf8").digest("hex");
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
      ON password_reset_tokens(token_hash);

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id_unused
      ON password_reset_tokens(user_id)
      WHERE used_at IS NULL;
  `);
}

async function sendPasswordResetEmail({ to, resetLink, expiresAt }) {
  await mailer.sendMail({
    from: process.env.MAIL_FROM || "no-reply@example.com",
    to,
    subject: "Reset your password",
    text: `Use this link to reset your password: ${resetLink}\n\nThis link expires at ${expiresAt.toISOString()} and can only be used once.`,
    html: `
      <p>Use this link to reset your password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>This link expires at ${expiresAt.toISOString()} and can only be used once.</p>
    `,
  });
}

async function initiatePasswordReset(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return { ok: true };
  }

  const userResult = await pool.query(
    `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [normalizedEmail]
  );

  if (userResult.rowCount === 0) {
    return { ok: true };
  }

  const user = userResult.rows[0];

  const plaintextToken = generatePlaintextResetToken();
  const tokenHash = hashResetToken(plaintextToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [user.id]
    );

    await client.query(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [user.id, tokenHash, expiresAt]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const resetLink = `${APP_BASE_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(
    plaintextToken
  )}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetLink,
      expiresAt,
    });
  } catch (err) {
    await pool.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE token_hash = $1
          AND used_at IS NULL
      `,
      [tokenHash]
    );

    throw err;
  }

  return { ok: true };
}

async function completePasswordReset(plaintextToken, newPassword) {
  if (!plaintextToken || typeof plaintextToken !== "string") {
    return { ok: false };
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const tokenHash = hashResetToken(plaintextToken);
  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE
      `,
      [tokenHash]
    );

    if (tokenResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false };
    }

    const resetToken = tokenResult.rows[0];

    await client.query(
      `
        UPDATE users
        SET password_hash = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [newPasswordHash, resetToken.user_id]
    );

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = $1
          AND used_at IS NULL
      `,
      [resetToken.id]
    );

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [resetToken.user_id]
    );

    await client.query("COMMIT");

    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

app.post("/password-reset/initiate", async (req, res, next) => {
  try {
    await initiatePasswordReset(req.body.email);

    res.status(202).json({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (err) {
    next(err);
  }
});

app.post("/password-reset/complete", async (req, res, next) => {
  try {
    const result = await completePasswordReset(req.body.token, req.body.password);

    if (!result.ok) {
      return res.status(400).json({
        error: "Invalid or expired password reset token.",
      });
    }

    res.json({
      message: "Password has been reset successfully.",
    });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({
    error: "Internal server error.",
  });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);

  initDb()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
      });
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  app,
  initiatePasswordReset,
  completePasswordReset,
  generatePlaintextResetToken,
  hashResetToken,
};