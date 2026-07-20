```javascript
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const TOKEN_EXPIRY_MINUTES = 30;
const TOKEN_BYTE_LENGTH = 32;
const BCRYPT_ROUNDS = 12;

async function generateSecureToken() {
  const rawToken = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
  const hashedToken = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
  return { rawToken, hashedToken };
}

async function initiatePasswordReset(email) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT id, email FROM users WHERE email = $1 AND is_active = true",
      [email]
    );

    if (userResult.rows.length === 0) {
      await client.query("COMMIT");
      return {
        success: true,
        message:
          "If that email address is in our system, we have sent a password reset link.",
      };
    }

    const user = userResult.rows[0];

    await client.query(
      "UPDATE password_reset_tokens SET invalidated_at = NOW() WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL",
      [user.id]
    );

    const { rawToken, hashedToken } = await generateSecureToken();

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await client.query(
      `INSERT INTO password_reset_tokens 
        (user_id, token_hash, expires_at, created_at) 
       VALUES ($1, $2, $3, NOW())`,
      [user.id, hashedToken, expiresAt]
    );

    await client.query("COMMIT");

    const resetLink = `${process.env.APP_BASE_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_FROM}>`,
      to: user.email,
      subject: "Password Reset Request",
      text: `
You requested a password reset.

Click the link below to reset your password. This link expires in ${TOKEN_EXPIRY_MINUTES} minutes and can only be used once.

${resetLink}

If you did not request a password reset, please ignore this email and your password will remain unchanged.

For security, never share this link with anyone.
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<body>
  <p>You requested a password reset.</p>
  <p>Click the link below to reset your password. This link expires in <strong>${TOKEN_EXPIRY_MINUTES} minutes</strong> and can only be used once.</p>
  <p><a href="${resetLink}">Reset My Password</a></p>
  <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
  <p><em>For security, never share this link with anyone.</em></p>
</body>
</html>
      `.trim(),
    });

    return {
      success: true,
      message:
        "If that email address is in our system, we have sent a password reset link.",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function validateAndConsumeResetToken(rawToken, email) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT prt.id, prt.token_hash, prt.expires_at, prt.used_at, prt.invalidated_at, u.id AS user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
         AND prt.used_at IS NULL
         AND prt.invalidated_at IS NULL
         AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC
       LIMIT 1
       FOR UPDATE OF prt`,
      [email]
    );

    if (result.rows.length === 0) {
      await client.query("COMMIT");
      return { valid: false, reason: "Token not found or expired." };
    }

    const record = result.rows[0];

    const isMatch = await bcrypt.compare(rawToken, record.token_hash);

    if (!isMatch) {
      await client.query("COMMIT");
      return { valid: false, reason: "Invalid token." };
    }

    await client.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
      [record.id]
    );

    await client.query("COMMIT");

    return { valid: true, userId: record.user_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resetPassword(rawToken, email, newPassword) {
  const validation = await validateAndConsumeResetToken(rawToken, email);

  if (!validation.valid) {
    return { success: false, message: validation.reason };
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await pool.query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [hashedPassword, validation.userId]
  );

  return { success: true, message: "Password has been reset successfully." };
}

app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required." });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const result = await initiatePasswordReset(sanitizedEmail);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Password reset initiation error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
});

app.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token, email, and new password are required." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const result = await resetPassword(token, sanitizedEmail, newPassword);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (