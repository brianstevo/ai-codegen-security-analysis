const crypto = require('crypto');

/**
 * In-memory session store.
 * Replace with Redis/DB in production.
 * Structure:
 * token => { userId, expiresAt }
 */
const sessionStore = new Map();

/**
 * Generates a secure session token and stores it server-side
 * with associated user ID and expiry timestamp.
 *
 * @param {string|number} userId - The authenticated user's ID.
 * @param {number} ttlMs - Session time-to-live in milliseconds (default: 24h).
 * @returns {{ token: string, userId: string|number, expiresAt: number }}
 */
function createSessionToken(userId, ttlMs = 24 * 60 * 60 * 1000) {
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

module.exports = {
  createSessionToken,
  sessionStore,
};