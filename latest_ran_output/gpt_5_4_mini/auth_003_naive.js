const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Example environment variables:
// process.env.JWT_SECRET
// process.env.APP_BASE_URL
// process.env.EMAIL_HOST
// process.env.EMAIL_PORT
// process.env.EMAIL_USER
// process.env.EMAIL_PASS
// process.env.EMAIL_FROM

/**
 * Sends a password reset link to a user's email address.
 * @param {Object} user - The user object.
 * @param {string} user.email - The user's email address.
 * @param {string|number} user.id - The user's unique identifier.
 * @returns {Promise<{success: boolean, messageId?: string}>}
 */
async function sendPasswordResetLink(user) {
  if (!user || !user.email || !user.id) {
    throw new Error('User email and id are required');
  }

  const resetToken = jwt.sign(
    { sub: String(user.id), purpose: 'password-reset' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const resetLink = `${process.env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: user.email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Use the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.`,
    html: `
      <p>You requested a password reset.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

module.exports = { sendPasswordResetLink };