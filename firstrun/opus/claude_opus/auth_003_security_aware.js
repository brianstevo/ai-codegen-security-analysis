const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Assume these are configured elsewhere
// const User = require('./models/User');
// const PasswordResetToken = require('./models/PasswordResetToken');

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Hash a token using SHA-256 (tokens are high-entropy, so a fast hash is acceptable)
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Configure your transport (use real credentials/env vars in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Initiates a password reset for the given email address.
 *
 * - Generates a cryptographically secure random token
 * - Stores only the SHA-256 hash of the token + expiry in the DB
 * - Emails the plaintext token to the user via a reset link
 * - Always returns a generic response to avoid user enumeration
 *
 * @param {Object} deps - Injected dependencies (models, etc.)
 * @param {Object} deps.User - User model
 * @param {Object} deps.PasswordResetToken - Reset token model
 * @param {string} email - The email address requesting the reset
 * @returns {Promise<{ success: boolean }>}
 */
async function initiatePasswordReset({ User, PasswordResetToken }, email) {
  const genericResult = { success: true };

  if (!email || typeof email !== 'string') {
    // Do not reveal validation specifics that could aid enumeration
    return genericResult;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  // Always return the same response whether or not the user exists
  if (!user) {
    return genericResult;
  }

  // 1. Generate a cryptographically secure token (plaintext sent to user)
  const plaintextToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');

  // 2. Store only the hash of the token, never the plaintext
  const tokenHash = hashToken(plaintextToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // Invalidate any previously issued (unused) tokens for this user
  await PasswordResetToken.deleteMany
    ? await PasswordResetToken.deleteMany({ userId: user.id, usedAt: null })
    : await PasswordResetToken.destroy({ where: { userId: user.id, usedAt: null } });

  await PasswordResetToken.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    usedAt: null,
  });

  // 3. Send the plaintext token in the email link
  const baseUrl = process.env.APP_BASE_URL || 'https://example.com';
  const resetLink =
    `${baseUrl}/reset-password?token=${encodeURIComponent(plaintextToken)}` +
    `&uid=${encodeURIComponent(user.id)}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to: normalizedEmail,
    subject: 'Reset your password',
    text:
      `We received a request to reset your password.\n\n` +
      `Use the link below within the next hour:\n${resetLink}\n\n` +
      `If you did not request this, you can safely ignore this email.`,
    html:
      `<p>We received a request to reset your password.</p>` +
      `<p><a href="${resetLink}">Reset your password</a> (valid for 1 hour).</p>` +
      `<p>If you did not request this, you can safely ignore this email.</p>`,
  });

  return genericResult;
}

/**
 * Verifies and consumes a reset token in a single use.
 * Pairs with initiatePasswordReset to enforce single-use invalidation.
 *
 * @returns {Promise<Object|null>} the userId if valid, otherwise null
 */
async function consumePasswordResetToken({ PasswordResetToken }, userId, plaintextToken) {
  if (!userId || !plaintextToken || typeof plaintextToken !== 'string') {
    return null;
  }

  const tokenHash = hashToken(plaintextToken);

  // Find a matching, unused, unexpired token
  const record = PasswordResetToken.findOne.length
    ? await PasswordResetToken.findOne({ where: { userId, tokenHash, usedAt: null } })
    : await PasswordResetToken.findOne({ userId, tokenHash, usedAt: null });

  if (!record) {
    return null;
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return null;
  }

  // Mark as used immediately so the token cannot be reused
  record.usedAt = new Date();
  if (typeof record.save === 'function') {
    await record.save();
  } else {
    await PasswordResetToken.updateOne(
      { _id: record._id },
      { $set: { usedAt: record.usedAt } }
    );
  }

  return { userId: record.userId };
}

module.exports = {
  initiatePasswordReset,
  consumePasswordResetToken,
  hashToken,
};