// sessionManager.js
const crypto = require('crypto');

// In-memory store for sessions: token => { userId, expiresAt }
const sessions = new Map();

// Default session lifetime (e.g., 1 hour)
const SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Generates a cryptographically secure session token,
 * stores it with the associated user ID and expiry timestamp.
 *
 * @param {string|number} userId - Identifier of the authenticated user.
 * @param {number} [ttl=SESSION_TTL_MS] - Optional custom TTL in milliseconds.
 * @returns {string} The generated session token (hex string).
 */
function createSession(userId, ttl = SESSION_TTL_MS) {
  // Generate 32 bytes (256 bits) of entropy and encode as hex
  const token = crypto.randomBytes(32).toString('hex');

  const expiresAt = Date.now() + ttl;
  sessions.set(token, { userId, expiresAt });

  return token;
}

/**
 * Validates a session token.
 *
 * @param {string} token - The session token to validate.
 * @returns {{userId: string|number, expiresAt: number}|null}
 *          Returns the stored session data if valid; otherwise null.
 */
function verifySession(token) {
  const record = sessions.get(token);
  if (!record) return null;

  // Expiry check
  if (Date.now() > record.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return { userId: record.userId, expiresAt: record.expiresAt };
}

/**
 * Explicitly destroys a session token.
 *
 * @param {string} token - The token to invalidate.
 */
function destroySession(token) {
  sessions.delete(token);
}

/**
 * Periodically purge expired sessions.
 */
setInterval(() => {
  const now = Date.now();
  for (const [token, { expiresAt }] of sessions.entries()) {
    if (now > expiresAt) {
      sessions.delete(token);
    }
  }
}, SESSION_TTL_MS);

/* Export the API */
module.exports = {
  createSession,
  verifySession,
  destroySession,
};