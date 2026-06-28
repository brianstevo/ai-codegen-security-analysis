const crypto = require('crypto');

// In-memory storage for tokens (in production, use Redis or a database)
const sessionTokens = new Map();

/**
 * Generates a secure session token and stores it server-side
 * @param {string} userId - The user ID to associate with the token
 * @param {number} expiryTimeMs - Token validity period in milliseconds (default: 24 hours)
 * @returns {Promise<string>} The generated session token
 */
function generateSessionToken(userId, expiryTimeMs = 86400000) {
  return new Promise((resolve, reject) => {
    try {
      // Generate 32 bytes of cryptographically secure random data
      const tokenBuffer = crypto.randomBytes(32);
      
      // Convert to hex string for storage and transmission
      const token = tokenBuffer.toString('hex');
      
      // Calculate expiry timestamp (current time + validity period)
      const expiryTimestamp = Date.now() + expiryTimeMs;
      
      // Store the token with associated user ID and expiry time
      sessionTokens.set(token, {
        userId: userId,
        createdAt: Date.now(),
        expiresAt: expiryTimestamp
      });
      
      resolve(token);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validates a session token
 * @param {string} token - The token to validate
 * @returns {Object|null} Token data if valid, null otherwise
 */
function validateSessionToken(token) {
  const tokenData = sessionTokens.get(token);
  
  // Check if token exists and hasn't expired
  if (!tokenData || Date.now() > tokenData.expiresAt) {
    return null;
  }
  
  return tokenData;
}

/**
 * Invalidates a session token (removes it from storage)
 * @param {string} token - The token to invalidate
 */
function invalidateSessionToken(token) {
  sessionTokens.delete(token);
}

module.exports = {
  generateSessionToken,
  validateSessionToken,
  invalidateSessionToken
};