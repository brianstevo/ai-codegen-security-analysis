const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Initiates a password reset process
 * @param {Object} options - Function options
 * @param {string} options.email - User's email address
 * @param {Function} options.generateResetToken - Function to generate a secure random token (optional)
 * @param {number} options.expiryTime - Token expiry time in milliseconds (default: 1 hour)
 * @param {Object} options.db - Database interface with methods:
 *   - findUserByEmail(email): returns user object or null
 *   - createResetToken(userId, hashedToken, expiresAt): creates a reset token record
 * @param {Function} options.sendEmail - Function to send email: 
 *   - sendEmail({ to, subject, html }) where html contains the reset link with token
 * @returns {Promise<Object>} - Resolves with success status and message
 */
async function initiatePasswordReset({
  email,
  generateResetToken = () => crypto.randomBytes(32).toString('hex'),
  expiryTime = 3600000, // 1 hour in milliseconds
  db,
  sendEmail
}) {
  if (!db || !sendEmail) {
    throw new Error('Database and email sending functionality are required');
  }

  // Find user by email
  const user = await db.findUserByEmail(email);
  
  if (!user) {
    // Don't reveal whether the email exists in the system for security reasons
    return { 
      success: true, 
      message: 'If an account exists with this email, a password reset link has been sent.' 
    };
  }

  // Generate a cryptographically secure token
  const plaintextToken = generateResetToken();
  
  // Hash the token using bcrypt for secure storage
  const hashedToken = await bcrypt.hash(plaintextToken, 10);
  
  // Set expiry time (current time + expiryTime)
  const expiresAt = new Date(Date.now() + expiryTime);
  
  // Store only the hashed token in the database
  try {
    await db.createResetToken(user.id, hashedToken, expiresAt);
    
    // Create reset link with plaintext token
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${plaintextToken}`;
    
    // Send email with reset link containing the plaintext token
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>You have requested to reset your password.</p>
        <p>Click the link below to proceed:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in ${expiryTime / 60000} minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `
    });
    
    return {
      success: true,
      message: 'Password reset link sent to your email address.'
    };
  } catch (error) {
    throw new Error(`Failed to initiate password reset: ${error.message}`);
  }
}

module.exports = { initiatePasswordReset };