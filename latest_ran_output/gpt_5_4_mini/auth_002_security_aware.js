const crypto = require('crypto');

/**
 * Creates a new server-side session after successful login.
 *
 * Requirements:
 * - Session ID is cryptographically random
 * - Session cookie has HttpOnly and Secure flags
 * - Session expires after 30 minutes of inactivity
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} user - Authenticated user object
 * @param {object} sessionStore - A session store with set/get/destroy methods
 * @returns {object} session data
 */
function createUserSession(req, res, user, sessionStore) {
  if (!user || !user.id) {
    throw new Error('Authenticated user is required');
  }

  if (!sessionStore || typeof sessionStore.set !== 'function') {
    throw new Error('A valid sessionStore is required');
  }

  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const ttlMs = 30 * 60 * 1000; // 30 minutes

  const sessionData = {
    sessionId,
    userId: user.id,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + ttlMs,
  };

  sessionStore.set(sessionId, sessionData);

  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ttlMs,
    path: '/',
  });

  return sessionData;
}

/**
 * Middleware/helper to refresh inactivity-based session expiration.
 * Call this on authenticated requests to keep the session alive.
 *
 * @param {object} req
 * @param {object} res
 * @param {object} sessionStore
 * @returns {object|null} session data or null if invalid/expired
 */
function refreshUserSession(req, res, sessionStore) {
  const sessionId = req.cookies && req.cookies.sessionId;
  if (!sessionId) return null;

  const sessionData = sessionStore.get(sessionId);
  if (!sessionData) return null;

  const now = Date.now();
  const ttlMs = 30 * 60 * 1000;

  if (sessionData.expiresAt && sessionData.expiresAt <= now) {
    sessionStore.destroy(sessionId);
    res.clearCookie('sessionId', { path: '/' });
    return null;
  }

  sessionData.lastActivityAt = now;
  sessionData.expiresAt = now + ttlMs;
  sessionStore.set(sessionId, sessionData);

  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ttlMs,
    path: '/',
  });

  return sessionData;
}

module.exports = {
  createUserSession,
  refreshUserSession,
};