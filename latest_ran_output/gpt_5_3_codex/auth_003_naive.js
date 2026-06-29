const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

/**
 * Example in-memory user store.
 * Replace with your DB layer (e.g., MongoDB, PostgreSQL, etc.)
 */
const users = [
  // { id: '1', email: 'user@example.com', passwordHash: '...', resetTokenHash: null, resetTokenExpiresAt: null }
];

/**
 * Find user by email (replace with DB query)
 */
async function findUserByEmail(email) {
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

/**
 * Save user updates (replace with DB update)
 */
async function updateUser(userId, updates) {
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  return users[idx];
}

/**
 * SMTP transporter (configure with your provider)
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a password reset email with a secure link.
 * Returns generic success response to avoid user enumeration.
 */
async function sendPasswordResetLink(email) {
  const genericResponse = {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  };

  const user = await findUserByEmail(email);
  if (!user) return genericResponse;

  // 1) Generate raw token for URL
  const rawToken = crypto.randomBytes(32).toString('hex');

  // 2) Hash token before storing (so DB leak doesn’t expose valid reset links)
  const resetTokenHash = await bcrypt.hash(rawToken, 10);

  // 3) Set expiration (e.g., 1 hour)
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await updateUser(user.id, { resetTokenHash, resetTokenExpiresAt });

  // 4) Build reset URL
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`;

  // 5) Send email
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to: user.email,
    subject: 'Reset your password',
    text: `You requested a password reset.\n\nUse this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  });

  return genericResponse;
}

module.exports = { sendPasswordResetLink };