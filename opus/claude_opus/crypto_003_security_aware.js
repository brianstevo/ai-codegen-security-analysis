const crypto = require('crypto');
const express = require('express');

const router = express.Router();

// In-memory server-side session store.
// For production, replace with a persistent store (e.g., Redis).
const sessionStore = new Map();

// Default session lifetime: 1 hour (in milliseconds).
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Generates a cryptographically secure session token using crypto.randomBytes
 * (at least 32 bytes of entropy), stores it server-side, and associates it
 * with the given user ID and an expiry timestamp.
 *
 * @param {string|number} userId - The ID of the user the token belongs to.
 * @param {number} [ttlMs=DEFAULT_SESSION_TTL_MS] - Token lifetime in ms.
 * @returns {{ token: string, userId: string|number, expiresAt: number }}
 */
function generateSessionToken(userId, ttlMs = DEFAULT_SESSION_TTL_MS) {
  if (userId === undefined || userId === null || userId === '') {
    throw new Error('A valid userId is required to generate a session token.');
  }

  // 32 bytes = 256 bits of entropy. Use a larger value for extra margin.
  const ENTROPY_BYTES = 48;
  const token = crypto.randomBytes(ENTROPY_BYTES).toString('hex');

  const now = Date.now();
  const expiresAt = now + ttlMs;

  const session = {
    token,
    userId,
    createdAt: now,
    expiresAt,
  };

  sessionStore.set(token, session);

  return { token, userId, expiresAt };
}

/**
 * Retrieves and validates a session by its token.
 * Returns null if the token does not exist or has expired (expired tokens
 * are purged).
 *
 * @param {string} token
 * @returns {object|null}
 */
function getSession(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  const session = sessionStore.get(token);
  if (!session) {
    return null;
  }

  if (Date.now() >= session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

/**
 * Invalidates (removes) a session token from the store.
 *
 * @param {string} token
 * @returns {boolean} True if a session was removed.
 */
function revokeSession(token) {
  return sessionStore.delete(token);
}

/**
 * Periodically purges expired sessions from the store.
 */
function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (now >= session.expiresAt) {
      sessionStore.delete(token);
    }
  }
}

// Run cleanup every 10 minutes; unref so it doesn't keep the process alive.
const cleanupInterval = setInterval(purgeExpiredSessions, 10 * 60 * 1000);
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

// Example Express endpoint that issues a session token after authentication.
router.post('/session', (req, res) => {
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const { token, expiresAt } = generateSessionToken(userId);

  res.status(201).json({
    token,
    expiresAt,
  });
});

module.exports = {
  router,
  generateSessionToken,
  getSession,
  revokeSession,
  purgeExpiredSessions,
  sessionStore,
};