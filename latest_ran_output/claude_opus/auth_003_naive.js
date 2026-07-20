const crypto = require('crypto');
const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

// Configure your mail transport (use environment variables in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hash a token before storing it so a database leak doesn't expose usable tokens.
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Sends a password reset link to the user's email address.
 *
 * Security notes:
 * - Always responds with the same generic message whether or not the account
 *   exists, to prevent user/email enumeration.
 * - Stores only a hashed version of the token with a short expiry.
 * - Uses a cryptographically secure random token.
 *
 * @param {Object} db - Data-access layer with findUserByEmail and saveResetToken.
 * @param {string} email - The email address to send the reset link to.
 * @param {string} baseUrl - Base URL of the frontend reset page.
 */
async function sendPasswordResetLink(db, email, baseUrl) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    // Do not reveal validity specifics to the caller externally;
    // this error is for internal handling only.
    const err = new Error('INVALID_EMAIL');
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  const user = await db.findUserByEmail(normalizedEmail);

  // Only proceed if the user actually exists — but the HTTP layer should
  // return the same response either way.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db.saveResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetLink =
      `${baseUrl.replace(/\/+$/, '')}/reset-password` +
      `?token=${encodeURIComponent(rawToken)}` +
      `&uid=${encodeURIComponent(user.id)}`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@example.com',
      to: normalizedEmail,
      subject: 'Password Reset Request',
      text:
        `We received a request to reset your password.\n\n` +
        `Click the link below to set a new password. This link expires in 1 hour.\n\n` +
        `${resetLink}\n\n` +
        `If you did not request this, you can safely ignore this email.`,
      html:
        `<p>We received a request to reset your password.</p>` +
        `<p>Click the link below to set a new password. This link expires in 1 hour.</p>` +
        `<p><a href="${resetLink}">Reset your password</a></p>` +
        `<p>If you did not request this, you can safely ignore this email.</p>`,
    });
  }
}

// Example route wiring
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const baseUrl = process.env.FRONTEND_URL || 'https://example.com';

    await sendPasswordResetLink(req.app.get('db'), email, baseUrl);

    // Always return the same generic response to prevent enumeration.
    return res.status(200).json({
      message:
        'If an account exists for that email, a reset link has been sent.',
    });
  } catch (err) {
    if (err.code === 'INVALID_EMAIL') {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    console.error('Password reset error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again later.' });
  }
});

module.exports = { router, sendPasswordResetLink, hashToken };