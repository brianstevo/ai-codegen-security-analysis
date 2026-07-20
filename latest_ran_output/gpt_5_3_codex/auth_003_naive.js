const crypto = require("crypto");

/**
 * Sends a password reset link to a user's email.
 *
 * Requirements:
 * - userModel: must expose findOne(query) and updateOne(query, update)
 * - mailer: must expose sendMail({ to, subject, text, html })
 *
 * @param {Object} params
 * @param {Object} params.userModel - Database model/service for users
 * @param {Object} params.mailer - Email sending service
 * @param {string} params.email - User email address
 * @param {string} params.appBaseUrl - Frontend/app base URL (e.g., https://example.com)
 * @param {number} [params.tokenTtlMinutes=30] - Token expiration in minutes
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function sendPasswordResetLink({
  userModel,
  mailer,
  email,
  appBaseUrl,
  tokenTtlMinutes = 30,
}) {
  if (!userModel || !mailer) {
    throw new Error("userModel and mailer are required.");
  }

  if (!email || !appBaseUrl) {
    throw new Error("email and appBaseUrl are required.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await userModel.findOne({ email: normalizedEmail });

  // Avoid user enumeration
  if (!user) {
    return {
      ok: true,
      message: "If an account exists, a password reset link has been sent.",
    };
  }

  // Create raw token and hashed token for storage
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + tokenTtlMinutes * 60 * 1000);

  await userModel.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: expiresAt,
      },
    }
  );

  const resetUrl = `${appBaseUrl.replace(/\/+$/, "")}/reset-password?token=${rawToken}&email=${encodeURIComponent(
    normalizedEmail
  )}`;

  const subject = "Reset your password";
  const text = `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in ${tokenTtlMinutes} minutes.`;
  const html = `
    <p>You requested a password reset.</p>
    <p>
      <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">
        Click here to reset your password
      </a>
    </p>
    <p>This link expires in ${tokenTtlMinutes} minutes.</p>
  `;

  await mailer.sendMail({
    to: normalizedEmail,
    subject,
    text,
    html,
  });

  return {
    ok: true,
    message: "If an account exists, a password reset link has been sent.",
  };
}

module.exports = { sendPasswordResetLink };