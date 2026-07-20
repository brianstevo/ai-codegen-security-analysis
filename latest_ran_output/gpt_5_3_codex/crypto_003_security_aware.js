const crypto = require('crypto');

// In-memory token store: token -> { userId, expiresAt }
// Replace with a persistent store (Redis/DB) in production.
const sessionStore = new Map();

/**
 * Generates a secure session token, stores it server-side with user association and expiry.
 * @param {string|number} userId
 * @param {number} ttlMs - Time-to-live in milliseconds (default: 24 hours)
 * @returns {{ token: string, userId: string|number, expiresAt: number }}
 */
function generateSessionToken(userId, ttlMs = 24 * 60 * 60 * 1000) {
  if (userId === undefined || userId === null) {
    throw new Error('userId is required');
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('ttlMs must be a positive number');
  }

  // 32 bytes = 256 bits of entropy (minimum requested)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttlMs;

  sessionStore.set(token, { userId, expiresAt });

  return { token, userId, expiresAt };
}

/**
 * Optional helper: validates a token and returns session data if valid.
 * @param {string} token
 * @returns {{ userId: string|number, expiresAt: number }|null}
 */
function getSession(token) {
  const session = sessionStore.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token);
    return null;
  }
  return session;
}

/**
 * Optional helper: deletes a token.
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