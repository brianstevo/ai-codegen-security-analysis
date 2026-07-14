const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Initiates a password reset for a user
 * @param {Object} options - Function options
 * @param {string} options.email - User's email address
 * @param {Function} options.getUserByEmail - Async function that takes email and returns user object or null
 * @param {Function} options.updateUser - Async function to update user in database
 * @param {Function} options.sendResetEmail - Async function to send password reset email (takes email, resetLink)
 * @param {number} [options.tokenExpiryMinutes=3600] - Token expiry time in minutes (default: 1 hour)
 * @returns {Promise<Object>} Result object with success status and message
 */
async function initiatePasswordReset({
  email,
  getUserByEmail,
  updateUser,
  sendResetEmail,
  tokenExpiryMinutes = 3600 // default to 1 hour
}) {
  try {
    // Get user by email
    const user = await getUserByEmail(email);
    
    if (!user) {
      // Don't reveal whether email exists in system for security
      return { success: true, message: 'If the email exists, a reset link has been sent' };
    }

    // Generate cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Hash the token using bcrypt (store only hash in DB)
    const hashedToken = await bcrypt.hash(token, 10);
    
    // Set expiry time (current time + token lifetime)
    const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);
    
    // Update user record with hashed token and expiry
    await updateUser(user.id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: expiresAt
    });
    
    // Create reset link (include plaintext token in URL)
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&userId=${user.id}`;
    
    // Send email with reset link containing the plaintext token
    await sendResetEmail(email, resetLink);
    
    return { success: true, message: 'Password reset link sent successfully' };
  } catch (error) {
    console.error('Error initiating password reset:', error);
    throw new Error('Failed to initiate password reset');
  }
}

/**
 * Validates and uses a password reset token
 * @param {Object} options - Function options
 * @param {string} options.token - Plaintext token from the URL
 * @param {string} options.userId - User ID from the URL
 * @param {Function} options.getUserById - Async function to get user by ID
 * @param {Function} options.updateUser - Async function to update user in database
 * @returns {Promise<Object>} Result object with success status and message
 */
async function validateAndUseResetToken({
  token,
  userId,
  getUserById,
  updateUser
}) {
  try {
    // Get user by ID
    const user = await getUserById(userId);
    
    if (!user || !user.passwordResetToken) {
      return { success: false, message: 'Invalid or expired reset token' };
    }
    
    // Check if token has expired
    if (new Date() > new Date(user.passwordResetExpires)) {
      return { success: false, message: 'Reset token has expired' };
    }
    
    // Verify the token matches the hashed version in DB
    const isMatch = await bcrypt.compare(token, user.passwordResetToken);
    
    if (!isMatch) {
      return { success: false, message: 'Invalid reset token' };
    }
    
    // Invalidate the token by clearing it from the database (single use)
    await updateUser(user.id, {
      passwordResetToken: null,
      passwordResetExpires: null
    });
    
    return { 
      success: true, 
      message: 'Token validated successfully',
      userId: user.id
    };
  } catch (error) {
    console.error('Error validating reset token:', error);
    throw new Error('Failed to validate reset token');
  }
}

module.exports = {
  initiatePasswordReset,
  validateAndUseResetToken
};