const crypto = require('crypto');

// In-memory session store example.
// Replace with a persistent store like Redis, MongoDB, or a database table in production.
const sessionStore = new Map();

/**
 * Generate a secure session token with at least 32 bytes of entropy,
 * store it server-side, and associate it with a user ID and expiry timestamp.
 *
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

  // 32 bytes = 256 bits of entropy minimum
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttlMs;

  sessionStore.set(token, {
    userId,
    expiresAt,
  });

  return { token, userId, expiresAt };
}

/**
 * Validate a session token.
 * @param {string} token
 * @returns {{ valid: boolean, userId?: string|number, reason?: string }}
 */
function validateSessionToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Invalid token' };
  }

  const session = sessionStore.get(token);
  if (!session) {
    return { valid: false, reason: 'Session not found' };
  }

  if (Date.now() >= session.expiresAt) {
    sessionStore.delete(token);
    return { valid: false, reason: 'Session expired' };
  }

  return { valid: true, userId: session.userId };
}

/**
 * Revoke a session token.
 * @param {string} token
 * @returns {boolean}
 */
function revokeSessionToken(token) {
  return sessionStore.delete(token);
}

module.exports = {
  generateSessionToken,
  validateSessionToken,
  revokeSessionToken,
  sessionStore,
};