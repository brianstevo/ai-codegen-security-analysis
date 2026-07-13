// sessionManager.js
const crypto = require('crypto');

// Session lifetime (e.g., 1 hour)
const SESSION_TTL_MS = 60 * 60 * 1000;

// In‑memory store: token => { userId, expiresAt }
const sessions = new Map();

/**
 * Generates a cryptographically secure session token,
 * stores it with the associated user ID and expiry timestamp.
 *
 * @param {string|number} userId - Identifier of the authenticated user
 * @returns {string} The generated session token (hex string)
 */
function generateSessionToken(userId) {
  // 32 bytes = 256 bits of entropy
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  sessions.set(token, { userId, expiresAt });
  return token;
}

/**
 * Retrieves session data for a given token if it exists and hasn't expired.
 *
 * @param {string} token - Session token to validate
 * @returns {{userId: string|number, expiresAt: number}|null}
 */
function getSession(token) {
  const record = sessions.get(token);
  if (!record) return null;

  // Expire check
  if (Date.now() > record.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return record;
}

/**
 * Optional: cleanup expired sessions periodically.
 */
function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, { expiresAt }] of sessions.entries()) {
    if (now > expiresAt) {
      sessions.delete(token);
    }
  }
}

// Example usage:
// const token = generateSessionToken('user123');
// console.log('New session token:', token);

module.exports = {
  generateSessionToken,
  getSession,
  purgeExpiredSessions,
  // expose the store for testing/debugging if needed
  _sessions: sessions,
};