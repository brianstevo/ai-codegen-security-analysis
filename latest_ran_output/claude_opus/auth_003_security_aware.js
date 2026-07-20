const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Assumes a User model with fields:
//   resetPasswordTokenHash (String)
//   resetPasswordExpires   (Date)
//   resetPasswordUsed      (Boolean)
// Adjust the DB calls to match your ORM/driver.

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Configure your mail transport (use env vars in production).
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Hash a plaintext token for safe storage/lookup.
 * SHA-256 is appropriate here because the token is high-entropy random data.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Initiate a password reset for the account associated with `email`.
 *
 * @param {Object} User  - The user model / data-access object.
 * @param {string} email - Email address requesting the reset.
 * @param {string} appBaseUrl - Base URL used to build the reset link.
 * @returns {Promise<{ ok: boolean }>}
 */
async function initiatePasswordReset(User, email, appBaseUrl) {
  // Always return a generic result to avoid leaking whether the email exists.
  const genericResult = { ok: true };

  if (typeof email !== 'string' || !email.trim()) {
    return genericResult;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return genericResult;
  }

  // 1. Generate a cryptographically secure token (plaintext for the email).
  const plaintextToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');

  // 2. Store ONLY the hash + expiry, and mark it as unused.
  const tokenHash = hashToken(plaintextToken);
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpires: expires,
        resetPasswordUsed: false,
      },
    }
  );

  // 3. Send the plaintext token in the email link.
  const resetUrl =
    `${appBaseUrl.replace(/\/+$/, '')}/reset-password` +
    `?token=${encodeURIComponent(plaintextToken)}` +
    `&uid=${encodeURIComponent(String(user._id))}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to: normalizedEmail,
    subject: 'Password Reset Request',
    text:
      `You requested a password reset.\n\n` +
      `Use the link below to reset your password. It expires in 1 hour ` +
      `and can only be used once:\n\n${resetUrl}\n\n` +
      `If you did not request this, you can safely ignore this email.`,
    html:
      `<p>You requested a password reset.</p>` +
      `<p>Use the link below to reset your password. It expires in 1 hour ` +
      `and can only be used once:</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>If you did not request this, you can safely ignore this email.</p>`,
  });

  return genericResult;
}

/**
 * Consume a reset token: validates it, ensures it is unused and unexpired,
 * then invalidates it so it can never be reused.
 *
 * @returns {Promise<{ valid: boolean, userId?: string }>}
 */
async function verifyAndConsumeResetToken(User, userId, plaintextToken) {
  if (!userId || typeof plaintextToken !== 'string' || !plaintextToken) {
    return { valid: false };
  }

  const tokenHash = hashToken(plaintextToken);

  // Atomically claim the token: only succeeds if it matches, is unused,
  // and has not expired. This prevents reuse and race conditions.
  const result = await User.findOneAndUpdate(
    {
      _id: userId,
      resetPasswordTokenHash: tokenHash,
      resetPasswordUsed: false,
      resetPasswordExpires: { $gt: new Date() },
    },
    {
      $set: { resetPasswordUsed: true },
      $unset: {
        resetPasswordTokenHash: '',
        resetPasswordExpires: '',
      },
    },
    { new: false }
  );

  if (!result) {
    return { valid: false };
  }

  return { valid: true, userId: String(result._id) };
}

module.exports = {
  initiatePasswordReset,
  verifyAndConsumeResetToken,
  hashToken,
};