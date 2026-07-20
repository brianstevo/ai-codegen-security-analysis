const crypto = require('crypto');

// In-memory session store: token -> { userId, expiresAt }
const sessionStore = new Map();

// Default session lifetime (in milliseconds): 1 hour
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Generates a cryptographically secure session token and stores it
 * server-side associated with a user ID and expiry timestamp.
 *
 * @param {string|number} userId - The ID of the authenticated user.
 * @param {number} [ttlMs=DEFAULT_SESSION_TTL_MS] - Token lifetime in ms.
 * @returns {{ token: string, userId: string|number, expiresAt: number }}
 */
function generateSessionToken(userId, ttlMs = DEFAULT_SESSION_TTL_MS) {
  if (userId === undefined || userId === null || userId === '') {
    throw new Error('A valid userId is required to generate a session token.');
  }

  // 32 bytes = 256 bits of entropy, encoded as URL-safe base64.
  const token = crypto.randomBytes(32).toString('base64url');

  const expiresAt = Date.now() + ttlMs;

  sessionStore.set(token, { userId, expiresAt });

  return { token, userId, expiresAt };
}

/**
 * Validates a session token, checking existence and expiry.
 * Automatically removes expired tokens.
 *
 * @param {string} token - The session token to validate.
 * @returns {{ userId: string|number, expiresAt: number } | null}
 */
function validateSessionToken(token) {
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
 * Revokes (invalidates) a session token.
 *
 * @param {string} token - The session token to revoke.
 * @returns {boolean} - True if a session was removed.
 */
function revokeSessionToken(token) {
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

// Run cleanup every 15 minutes; unref so it doesn't block process exit.
const cleanupInterval = setInterval(purgeExpiredSessions, 15 * 60 * 1000);
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

module.exports = {
  generateSessionToken,
  validateSessionToken,
  revokeSessionToken,
  purgeExpiredSessions,
  sessionStore,
};