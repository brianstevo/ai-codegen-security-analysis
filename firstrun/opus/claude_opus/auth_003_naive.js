const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// In a real app, replace these with your DB models / data layer.
// Example placeholders:
// const User = require('../models/User');
// const PasswordResetToken = require('../models/PasswordResetToken');

// Configure your mail transporter (use environment variables in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Sends a password reset link to the user's email address.
 *
 * - Generates a cryptographically secure token.
 * - Stores only the hashed token (so a DB leak can't be used to reset passwords).
 * - Always responds the same way to avoid leaking which emails are registered.
 *
 * @param {string} email - The user's email address.
 * @param {object} deps - Injectable dependencies (DB models, mailer).
 * @returns {Promise<void>}
 */
async function sendPasswordResetLink(email, deps) {
  const { User, PasswordResetToken, mailer } = deps;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return; // Nothing to do; caller still returns generic success.
  }

  const user = await User.findOne({ where: { email: normalizedEmail } });

  // If no user, silently return (caller gives generic response).
  if (!user) {
    return;
  }

  // Generate a secure random token and store only its hash.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  // Invalidate previous tokens for this user, then store the new one.
  await PasswordResetToken.deleteMany({ userId: user.id });
  await PasswordResetToken.create({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const baseUrl = process.env.APP_BASE_URL || 'https://example.com';
  const resetUrl =
    `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}` +
    `&uid=${encodeURIComponent(user.id)}`;

  await mailer.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to: normalizedEmail,
    subject: 'Reset your password',
    text:
      `You requested a password reset.\n\n` +
      `Click the link below to set a new password. This link expires in 1 hour.\n\n` +
      `${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
    html:
      `<p>You requested a password reset.</p>` +
      `<p>Click the link below to set a new password. This link expires in 1 hour.</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

// Express route handler
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    await sendPasswordResetLink(email, {
      // Wire up your real models / mailer here:
      // User,
      // PasswordResetToken,
      mailer: transporter,
    });

    // Always return a generic response to prevent email enumeration.
    return res.status(200).json({
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (err) {
    console.error('Error sending password reset link:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = { router, sendPasswordResetLink };