const crypto = require('crypto');

// In-memory session store example.
// In production, replace with Redis, a database, or another persistent store.
const sessionStore = new Map();

/**
 * Generates a secure session token with at least 32 bytes of entropy,
 * stores it server-side, and associates it with a user ID and expiry timestamp.
 *
 * @param {string|number} userId
 * @param {number} [ttlMs=1000 * 60 * 60 * 24] - Time to live in milliseconds (default: 24 hours)
 * @returns {{ token: string, userId: string|number, expiresAt: number }}
 */
function generateSessionToken(userId, ttlMs = 1000 * 60 * 60 * 24) {
  if (userId === undefined || userId === null) {
    throw new Error('userId is required');
  }

  // 32 bytes = 256 bits of entropy
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttlMs;

  sessionStore.set(token, {
    userId,
    expiresAt,
  });

  return { token, userId, expiresAt };
}

/**
 * Retrieves a session by token if it exists and is not expired.
 *
 * @param {string} token
 * @returns {{ userId: string|number, expiresAt: number }|null}
 */
function getSession(token) {
  const session = sessionStore.get(token);
  if (!session) return null;

  if (Date.now() >= session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

/**
 * Invalidates a session token server-side.
 *
 * @param {string} token
 * @returns {boolean}
 */
function revokeSession(token) {
  return sessionStore.delete(token);
}

module.exports = {
  generateSessionToken,
  getSession,
  revokeSession,
  sessionStore,
};