const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

// Example User model interface expected:
// user.email
// user.passwordResetTokenHash
// user.passwordResetExpiresAt
// user.passwordResetUsedAt
// await user.save()
// static: await User.findOne({ email }) / await User.findById(id)

// Configure transporter as needed for your environment.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MINUTES = 30;
const BCRYPT_ROUNDS = 12;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

async function initiatePasswordReset(User, email) {
  // Always return generic success to avoid user enumeration
  const genericResponse = {
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  };

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) return genericResponse;

  // Generate cryptographically secure plaintext token
  const plaintextToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");

  // Hash token before storing in DB
  const tokenHash = await bcrypt.hash(plaintextToken, BCRYPT_ROUNDS);

  // Set expiry + reset one-time-use fields
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = expiresAt;
  user.passwordResetUsedAt = null;
  await user.save();

  // Send plaintext token in email link
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(
    plaintextToken
  )}&uid=${encodeURIComponent(String(user._id))}`;

  await transporter.sendMail({
    to: user.email,
    from: process.env.MAIL_FROM || "no-reply@example.com",
    subject: "Password reset request",
    text: `Reset your password using this link (valid for ${RESET_TOKEN_TTL_MINUTES} minutes): ${resetUrl}`,
    html: `<p>Reset your password using the link below (valid for ${RESET_TOKEN_TTL_MINUTES} minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

  return genericResponse;
}

async function consumePasswordResetTokenAndUpdatePassword(User, userId, plaintextToken, newPassword) {
  const user = await User.findById(userId);
  if (!user) throw new Error("Invalid or expired reset token.");

  // Ensure token exists, not already used, and not expired
  if (
    !user.passwordResetTokenHash ||
    !user.passwordResetExpiresAt ||
    user.passwordResetUsedAt ||
    user.passwordResetExpiresAt.getTime() < Date.now()
  ) {
    throw new Error("Invalid or expired reset token.");
  }

  // Compare plaintext token with hashed token in DB
  const isMatch = await bcrypt.compare(plaintextToken, user.passwordResetTokenHash);
  if (!isMatch) throw new Error("Invalid or expired reset token.");

  // Update password (hashing assumed here; adjust if your model middleware hashes automatically)
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Invalidate token after single use
  user.passwordResetUsedAt = new Date();
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;

  await user.save();

  return { ok: true, message: "Password has been reset successfully." };
}

module.exports = {
  initiatePasswordReset,
  consumePasswordResetTokenAndUpdatePassword,
};