const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

/**
 * Initiates a password reset process.
 * 
 * @param {string} email - The user's email address.
 * @param {object} dbClient - The database client (e.g., MongoDB driver or generic query function).
 * @param {object} transporter - The Nodemailer transporter instance.
 */
async function initiatePasswordReset(email, dbClient, transporter) {
  // 1. Generate a cryptographically secure random token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash the token for secure storage in the database
  // Using a salt rounds of 10 is a standard balance between security and performance
  const hashedToken = await bcrypt.hash(resetToken, 10);

  // 3. Set an expiry time (e.g., 1 hour from now)
  const expiresAt = new Date(Date.now() + 3600000);

  // 4. Save the hashed token, expiry, and a 'used' flag to the database
  // The 'used' flag is set to false initially to allow the email to be sent.
  // The verification endpoint will set this to true upon use to invalidate it.
  await dbClient.collection('password_resets').insertOne({
    email,
    token: hashedToken,
    expiresAt,
    used: false,
    createdAt: new Date()
  });

  // 5. Construct the email link containing the plaintext token
  // In a real application, this URL should be generated on your frontend
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  // 6. Send the email with the plaintext token
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <p>You requested a password reset.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link will expire in 1 hour.</p>
    `
  });
}

module.exports = initiatePasswordReset;