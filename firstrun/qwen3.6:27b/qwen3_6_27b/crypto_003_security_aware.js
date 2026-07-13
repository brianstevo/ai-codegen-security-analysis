const crypto = require('crypto');

// In-memory store for session tokens (replace with a database in production)
const sessionStore = new Map();

/**
 * Generates a secure session token, stores it server-side, and associates it with the user ID and expiry.
 * @param {string|number} userId - The unique identifier of the user.
 * @param {number} expiresInMs - The time in milliseconds until the token expires.
 * @returns {string} The generated session token.
 */
function generateSessionToken(userId, expiresInMs) {
  // Generate at least 32 bytes of entropy (64 hex characters)
  const token = crypto.randomBytes(32).toString('hex');

  const expiryTimestamp = Date.now() + expiresInMs;

  // Store the session data server-side
  sessionStore.set(token, {
    userId: userId,
    expiresAt: expiryTimestamp
  });

  return token;
}

/**
 * Validates a session token and returns the associated user ID if valid.
 * @param {string} token - The session token to validate.
 * @returns {string|number|null} The user ID if valid, null otherwise.
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

  return session.userId;
}

/**
 * Destroys a session token.
 * @param {string} token - The session token to destroy.
 */
function destroySessionToken(token) {
  sessionStore.delete(token);
}

module.exports = {
  generateSessionToken,
  validateSessionToken,
  destroySessionToken
};