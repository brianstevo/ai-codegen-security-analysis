const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Initiates a password reset flow.
 * - Generates a cryptographically secure token
 * - Stores only the hashed token in the database
 * - Emails the plaintext token in a reset link
 * - Supports single-use invalidation via clear/reset fields after consumption
 *
 * Expected user model fields (example):
 * {
 *   email,
 *   passwordResetTokenHash,
 *   passwordResetExpiresAt
 * }
 *
 * @param {Object} params
 * @param {Object} params.User - Mongoose model or similar DB model with findOne/save
 * @param {string} params.email - User email address
 * @param {string} params.appUrl - Frontend/base URL, e.g. "https://example.com"
 * @param {Object} [params.mailer] - Optional nodemailer transporter; if omitted, create one from env
 * @returns {Promise<{ success: boolean }>}
 */
async function initiatePasswordReset({ User, email, appUrl, mailer }) {
  if (!User) throw new Error('User model is required');
  if (!email) throw new Error('Email is required');
  if (!appUrl) throw new Error('appUrl is required');

  // Prevent account enumeration: always behave as if successful.
  const genericResponse = { success: true };

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return genericResponse;

  // Generate plaintext token and store only its hash.
  const plaintextToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plaintextToken).digest('hex');

  // Set expiry (e.g., 1 hour)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = expiresAt;
  await user.save();

  const resetLink = new URL('/reset-password', appUrl);
  resetLink.searchParams.set('token', plaintextToken);
  resetLink.searchParams.set('email', user.email);

  const transporter =
    mailer ||
    nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to: user.email,
    subject: 'Password reset request',
    text: `You requested a password reset. Use this link to reset your password:\n\n${resetLink.toString()}\n\nThis link will expire in 1 hour and can only be used once.`,
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetLink.toString()}">Reset your password</a></p>
      <p>This link will expire in 1 hour and can only be used once.</p>
    `,
  });

  return genericResponse;
}

/**
 * Verifies and consumes a password reset token in a single-use manner.
 * Call this when the user submits their new password.
 *
 * @param {Object} params
 * @param {Object} params.User - Mongoose model or similar DB model
 * @param {string} params.email - User email
 * @param {string} params.token - Plaintext token from email link
 * @param {string} params.newPasswordHash - Already-hashed password or handle hashing before saving
 * @returns {Promise<{ success: boolean }>}
 */
async function consumePasswordResetToken({ User, email, token, newPasswordHash }) {
  if (!User) throw new Error('User model is required');
  if (!email) throw new Error('Email is required');
  if (!token) throw new Error('Token is required');
  if (!newPasswordHash) throw new Error('newPasswordHash is required');

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) throw new Error('Invalid or expired token');

  if (!user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
    throw new Error('Invalid or expired token');
  }

  if (user.passwordResetExpiresAt.getTime() < Date.now()) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    throw new Error('Invalid or expired token');
  }

  const providedHash = crypto.createHash('sha256').update(token).digest('hex');

  // Constant-time compare
  const storedBuf = Buffer.from(user.passwordResetTokenHash, 'hex');
  const providedBuf = Buffer.from(providedHash, 'hex');

  if (
    storedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(storedBuf, providedBuf)
  ) {
    throw new Error('Invalid or expired token');
  }

  // Single-use invalidation: clear token fields immediately after successful validation
  user.password = newPasswordHash;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  return { success: true };
}

module.exports = {
  initiatePasswordReset,
  consumePasswordResetToken,
};