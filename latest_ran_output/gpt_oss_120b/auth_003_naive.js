const crypto = require('crypto');
const nodemailer = require('nodemailer');

// In-memory store for demo purposes; replace with a persistent DB in production
const resetTokens = new Map();

/**
 * Sends a password‑reset email containing a one‑time link.
 *
 * @param {string} email - The user's email address.
 * @returns {Promise<{ success: boolean }>} Result of the operation.
 */
async function sendPasswordReset(email) {
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // valid for 1 hour

  // Store token with associated email and expiry (replace with DB logic)
  resetTokens.set(token, { email, expiresAt });

  // Build the password‑reset URL (adjust domain as needed)
  const resetUrl = `https://yourdomain.com/reset-password?token=${encodeURIComponent(
    token
  )}&email=${encodeURIComponent(email)}`;

  // Configure nodemailer transporter (use real SMTP credentials)
  const transporter = nodemailer.createTransport({
    host: 'smtp.example.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: 'your_smtp_user',
      pass: 'your_smtp_pass',
    },
  });

  const mailOptions = {
    from: '"Support" <support@yourdomain.com>',
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click the link below to set a new password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    html: `<p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>If you did not request this, please ignore this email.</p>`,
  };

  // Send the email
  await transporter.sendMail(mailOptions);
  return { success: true };
}

// Export for use in route handlers or other modules
module.exports = {
  sendPasswordReset,
  resetTokens, // expose token store for verification elsewhere
};