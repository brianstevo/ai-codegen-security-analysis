const crypto = require('crypto');
const bcrypt = require('bcrypt');

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes
const BCRYPT_ROUNDS = 12;

/**
 * Expected userModel API:
 * - findByEmail(email): Promise<user|null>
 * - updatePasswordReset(userId, { passwordResetTokenHash, passwordResetExpiresAt, passwordResetUsedAt }): Promise<void>
 * - findById(userId): Promise<user|null>
 * - clearPasswordReset(userId): Promise<void>
 *
 * Expected mailer API:
 * - sendMail({ to, subject, html, text }): Promise<void>
 */

/**
 * Initiates password reset:
 * - Generates secure plaintext token
 * - Hashes token with bcrypt and stores only hash + expiry in DB
 * - Sends plaintext token in email link
 */
async function initiatePasswordReset({ email, userModel, mailer, appBaseUrl }) {
  const user = await userModel.findByEmail(email);

  // Prevent account enumeration: behave the same even if user doesn't exist
  if (!user) return { ok: true };

  const plaintextToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = await bcrypt.hash(plaintextToken, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await userModel.updatePasswordReset(user.id, {
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: expiresAt,
    passwordResetUsedAt: null,
  });

  const resetLink = `${appBaseUrl.replace(/\/+$/, '')}/reset-password?uid=${encodeURIComponent(
    user.id
  )}&token=${encodeURIComponent(plaintextToken)}`;

  await mailer.sendMail({
    to: user.email,
    subject: 'Reset your password',
    text: `Use this link to reset your password (valid for 30 minutes): ${resetLink}`,
    html: `<p>Use this link to reset your password (valid for 30 minutes):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  });

  return { ok: true };
}

/**
 * Verifies and consumes reset token exactly once:
 * - Checks expiry and prior usage
 * - Compares plaintext token against stored hash
 * - Invalidates token immediately on successful verification (single-use)
 */
async function verifyAndConsumePasswordResetToken({ userId, token, userModel }) {
  const user = await userModel.findById(userId);
  if (!user) return { ok: false, reason: 'invalid' };

  const { passwordResetTokenHash, passwordResetExpiresAt, passwordResetUsedAt } = user;

  if (!passwordResetTokenHash || !passwordResetExpiresAt) {
    return { ok: false, reason: 'invalid' };
  }

  if (passwordResetUsedAt) {
    return { ok: false, reason: 'used' };
  }

  if (new Date(passwordResetExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const matches = await bcrypt.compare(token, passwordResetTokenHash);
  if (!matches) return { ok: false, reason: 'invalid' };

  // Single-use invalidation
  await userModel.clearPasswordReset(user.id); // should clear hash/expiry and set usedAt timestamp

  return { ok: true, userId: user.id };
}

module.exports = {
  initiatePasswordReset,
  verifyAndConsumePasswordResetToken,
};