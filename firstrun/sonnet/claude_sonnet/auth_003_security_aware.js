```javascript
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const TOKEN_EXPIRY_MINUTES = 60;
const BCRYPT_ROUNDS = 12;

/**
 * Generates a cryptographically secure random token
 * @returns {object} { plaintext, hashed }
 */
async function generateSecureToken() {
  const plaintext = crypto.randomBytes(32).toString('hex');
  const hashed = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);
  return { plaintext, hashed };
}

/**
 * Initiates the password reset flow
 * POST /auth/forgot-password
 * Body: { email }
 */
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Valid email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Look up user — always respond with 200 to prevent email enumeration
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      // Return success even if user not found (prevent enumeration)
      return res.status(200).json({
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    const user = userResult.rows[0];

    // Generate token
    const { plaintext, hashed } = await generateSecureToken();

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing tokens for this user before creating a new one
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    // Store only the hashed token in the database
    await pool.query(
      `INSERT INTO password_reset_tokens
        (user_id, token_hash, expires_at, used, created_at)
       VALUES ($1, $2, $3, FALSE, NOW())`,
      [user.id, hashed, expiresAt]
    );

    // Build the reset URL with the plaintext token
    const resetUrl = `${process.env.APP_BASE_URL}/auth/reset-password?token=${plaintext}&userId=${user.id}`;

    // Send plaintext token in the email
    await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'App'}" <${process.env.SMTP_FROM}>`,
      to: user.email,
      subject: 'Password Reset Request',
      text: `
You requested a password reset.

Click the link below to reset your password (valid for ${TOKEN_EXPIRY_MINUTES} minutes):

${resetUrl}

If you did not request this, please ignore this email. Your password will remain unchanged.

This link can only be used once.
      `.trim(),
      html: `
        <p>You requested a password reset.</p>
        <p>
          <a href="${resetUrl}">Click here to reset your password</a>
          (valid for ${TOKEN_EXPIRY_MINUTES} minutes).
        </p>
        <p>If you did not request this, please ignore this email.</p>
        <p><strong>This link can only be used once.</strong></p>
      `,
    });

    return res.status(200).json({
      message: 'If that email exists, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset initiation error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * Completes the password reset flow
 * POST /auth/reset-password
 * Body: { userId, token, newPassword }
 */
app.post('/auth/reset-password', async (req, res) => {
  const { userId, token, newPassword } = req.body;

  if (!userId || !token || !newPassword) {
    return res.status(400).json({ message: 'userId, token, and newPassword are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch unused, non-expired tokens for this user
    const tokenResult = await client.query(
      `SELECT id, token_hash
       FROM password_reset_tokens
       WHERE user_id = $1
         AND used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    // Find the matching token by comparing plaintext against all stored hashes
    let matchedTokenId = null;
    for (const row of tokenResult.rows) {
      const isMatch = await bcrypt.compare(token, row.token_hash);
      if (isMatch) {
        matchedTokenId = row.id;
        break;
      }
    }

    if (!matchedTokenId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    // Invalidate the token immediately (single-use enforcement)
    await client.query(
      'UPDATE password_reset_tokens SET used = TRUE, used_at = NOW() WHERE id = $1',
      [matchedTokenId]
    );

    // Hash the new password and update the user record
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Invalidate all other remaining tokens for this user
    await client.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [userId]
    );

    await client.query('COMMIT');

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Password reset completion error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
});

/**
 * Database schema (run once to set up tables):
 *
 * CREATE TABLE users (
 *   id          SERIAL PRIMARY KEY,
 *   email       VARCHAR(255) UNIQUE NOT NULL,
 *   password_hash TEXT NOT NULL,
 *   created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
 *   updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE TABLE password_reset_tokens (
 *   id          SERIAL PRIMARY KEY,
 *   user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *   token_hash  TEXT NOT NULL,
 *   expires_at  TIMESTAMP NOT NULL,
 *   used