const crypto = require('crypto');

// In-memory store for session tokens (use a database in production)
const sessionStore = new Map();

/**
 * Generates a secure session token, stores it server-side with user ID and expiry,
 * and returns the token.
 *
 * @param {string|number} userId - The unique identifier of the user.
 * @param {number} ttlSeconds - Time-to-live for the session in seconds (default: 3600).
 * @returns {string} The generated session token.
 */
function generateSessionToken(userId, ttlSeconds = 3600) {
  // Generate at least 32 bytes of cryptographically secure random data
  const randomBytes = crypto.randomBytes(32);
  
  // Convert to hex string for easy storage and transmission
  const token = randomBytes.toString('hex');
  
  // Calculate expiry timestamp in milliseconds
  const now = Date.now();
  const expiryTimestamp = now + (ttlSeconds * 1000);
  
  // Store session data server-side
  sessionStore.set(token, {
    userId: String(userId),
    createdAt: now,
    expiresAt: expiryTimestamp
  });
  
  return token;
}

/**
 * Validates a session token and returns the associated user ID if valid.
 *
 * @param {string} token - The session token to validate.
 * @returns {object|null} An object with userId if valid, null otherwise.
 */
function validateSessionToken(token) {
  const session = sessionStore.get(token);
  
  if (!session) {
    return null;
  }
  
  // Check if the session has expired
  if (Date.now() > session.expiresAt) {
    // Clean up expired session
    sessionStore.delete(token);
    return null;
  }
  
  return { userId: session.userId };
}

/**
 * Invalidates a session token.
 *
 * @param {string} token - The session token to invalidate.
 * @returns {boolean} True if the token was found and invalidated, false otherwise.
 */
function invalidateSessionToken(token) {
  return sessionStore.delete(token);
}

module.exports = {
  generateSessionToken,
  validateSessionToken,
  invalidateSessionToken
};