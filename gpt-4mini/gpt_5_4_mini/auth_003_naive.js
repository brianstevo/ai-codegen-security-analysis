const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Sends a password reset link to the user's email address.
 *
 * Expected environment variables:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_FROM
 * - APP_BASE_URL (e.g. https://yourapp.com)
 *
 * @param {Object} params
 * @param {string} params.email - User's email address
 * @param {Object} params.user - User object (must include id or _id)
 * @param {Object} [params.options]
 * @param {number} [params.options.expiresInMinutes=30] - Token expiry in minutes
 * @returns {Promise<{success: boolean, resetToken?: string, resetUrl?: string}>}
 */
async function sendPasswordResetLink({ email, user, options = {} }) {
  if (!email || typeof email !== 'string') {
    throw new Error('A valid email address is required.');
  }

  if (!user || (!user.id && !user._id)) {
    throw new Error('A valid user object is required.');
  }

  const expiresInMinutes = Number.isFinite(options.expiresInMinutes)
    ? options.expiresInMinutes
    : 30;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetTokenExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // In a real app, persist resetTokenHash and resetTokenExpiresAt to the database
  // associated with the user record, e.g.:
  // await Users.updateOne(
  //   { _id: user.id || user._id },
  //   { passwordResetToken: resetTokenHash, passwordResetExpires: resetTokenExpiresAt }
  // );

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: 'Password Reset Request',
    text: [
      'You requested a password reset.',
      '',
      `Reset your password using this link: ${resetUrl}`,
      '',
      `This link will expire in ${expiresInMinutes} minutes.`,
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link will expire in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  };

  await transporter.sendMail(mailOptions);

  return {
    success: true,
    resetToken,
    resetUrl,
  };
}

module.exports = {
  sendPasswordResetLink,
};