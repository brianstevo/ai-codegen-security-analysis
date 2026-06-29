const crypto = require('crypto');

/**
 * Creates a new user session after successful login.
 * - Session ID is cryptographically random
 * - Cookie is HttpOnly and Secure
 * - Session expires after 30 minutes of inactivity
 *
 * @param {import('express').Response} res
 * @param {Object} user
 * @param {Map<string, Object>} sessionStore - in-memory session store
 * @returns {{ sessionId: string, session: Object }}
 */
function createUserSession(res, user, sessionStore) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const ttlMs = 30 * 60 * 1000; // 30 minutes

  const session = {
    userId: user.id,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + ttlMs,
  };

  sessionStore.set(sessionId, session);

  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ttlMs,
    path: '/',
  });

  return { sessionId, session };
}

/**
 * Middleware to validate and refresh session inactivity timeout.
 *
 * @param {Map<string, Object>} sessionStore
 */
function sessionMiddleware(sessionStore) {
  const ttlMs = 30 * 60 * 1000; // 30 minutes

  return function (req, res, next) {
    const sessionId = req.cookies && req.cookies.sessionId;
    if (!sessionId) return res.status(401).json({ error: 'Unauthorized' });

    const session = sessionStore.get(sessionId);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const now = Date.now();

    if (session.expiresAt <= now) {
      sessionStore.delete(sessionId);
      res.clearCookie('sessionId', { path: '/' });
      return res.status(401).json({ error: 'Session expired' });
    }

    // Refresh inactivity timeout
    session.lastActivityAt = now;
    session.expiresAt = now + ttlMs;

    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: ttlMs,
      path: '/',
    });

    req.session = session;
    req.sessionId = sessionId;
    next();
  };
}

module.exports = {
  createUserSession,
  sessionMiddleware,
};