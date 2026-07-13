const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock database interface for demonstration purposes
const db = {
  resetTokens: new Map(), // In-memory store for demo; replace with actual DB queries
};

/**
 * Initiates a password reset process.
 * 
 * @param {string} email - The user's email address.
 * @param {object} options - Configuration options.
 * @param {number} options.tokenExpiryMinutes - Token validity duration in minutes (default: 60).
 * @param {string} options.resetBaseUrl - Base URL for the reset link (e.g., 'https://example.com/reset').
 * @param {function} options.sendEmail - Async function to send email. Signature: async (to, subject, html) => Promise<void>.
 * @returns {Promise<{success: boolean, message: string}>} Result of the operation.
 */
async function initiatePasswordReset(email, options = {}) {
  const {
    tokenExpiryMinutes = 60,
    resetBaseUrl = 'https://example.com/reset',
    sendEmail = async () => {}, // Default no-op email sender
  } = options;

  try {
    // 1. Validate input
    if (!email || typeof email !== 'string') {
      return { success: false, message: 'Invalid email address.' };
    }

    // 2. Check if user exists (mocked here)
    // In a real app, query your database for the user by email
    const userExists = true; // Replace with actual DB check: await User.findOne({ email })
    if (!userExists) {
      // For security, don't reveal whether the email exists or not
      return { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
    }

    // 3. Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    
    // 4. Create expiry timestamp
    const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);

    // 5. Hash the token for secure storage
    const saltRounds = 10;
    const hashedToken = await bcrypt.hash(rawToken, saltRounds);

    // 6. Store hashed token in database associated with user email
    // In a real app, save to DB: await ResetToken.create({ userId, token: hashedToken, expiresAt })
    db.resetTokens.set(email, {
      hashedToken,
      expiresAt,
      used: false,
    });

    // 7. Construct reset link with plaintext token
    const resetLink = `${resetBaseUrl}?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // 8. Send email with reset link
    await sendEmail(email, 'Password Reset Request', `Click here to reset your password: <a href="${resetLink}">Reset Password</a>`);

    return { success: true, message: 'Password reset email sent.' };

  } catch (error) {
    console.error('Error initiating password reset:', error);
    return { success: false, message: 'An internal error occurred. Please try again later.' };
  }
}

/**
 * Validates and consumes a reset token (single-use invalidation).
 * 
 * @param {string} email - The user's email address.
 * @param {string} rawToken - The plaintext token from the URL.
 * @returns {Promise<{valid: boolean, message: string}>} Validation result.
 */
async function validateResetToken(email, rawToken) {
  try {
    // 1. Retrieve stored token data from database
    const tokenData = db.resetTokens.get(email);

    if (!tokenData) {
      return { valid: false, message: 'Invalid or expired token.' };
    }

    // 2. Check if token has been used
    if (tokenData.used) {
      return { valid: false, message: 'Token has already been used.' };
    }

    // 3. Check if token is expired
    if (new Date() > new Date(tokenData.expiresAt)) {
      // Optionally remove expired token from DB
      db.resetTokens.delete(email);
      return { valid: false, message: 'Token has expired.' };
    }

    // 4. Verify the raw token against the stored hash
    const isMatch = await bcrypt.compare(rawToken, tokenData.hashedToken);
    
    if (!isMatch) {
      return { valid: false, message: 'Invalid token.' };
    }

    // 5. Invalidate token after single use
    tokenData.used = true;
    db.resetTokens.set(email, tokenData);

    return { valid: true, message: 'Token is valid.' };

  } catch (error) {
    console.error('Error validating reset token:', error);
    return { valid: false, message: 'An internal error occurred.' };
  }
}

module.exports = { initiatePasswordReset, validateResetToken };