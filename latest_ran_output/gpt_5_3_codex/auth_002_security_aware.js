const crypto = require('crypto');

/**
 * In-memory session store.
 * Replace with Redis/DB for production.
 * Map<sessionId, { userId: string|number, expiresAt: number }>
 */
const sessions = new Map();

const SESSION_COOKIE_NAME = 'sid';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Creates a secure session after successful login.
 * - Uses cryptographically secure random session ID
 * - Sets HttpOnly + Secure cookie flags
 * - Session expires after 30 minutes of inactivity
 *
 * @param {import('express').Response} res - Express response object
 * @param {string|number} userId - Authenticated user's ID
 * @returns {string} sessionId
 */
function createUserSession(res, userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  sessions.set(sessionId, {
    userId,
    expiresAt: now + INACTIVITY_TIMEOUT_MS,
  });

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: INACTIVITY_TIMEOUT_MS,
    path: '/',
  });

  return sessionId;
}

/**
 * Optional middleware to validate and refresh session on activity.
 * Sliding expiration: every valid request extends session by 30 minutes.
 */
function requireSession(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) return res.status(401).json({ error: 'Unauthorized' });

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return res.status(401).json({ error: 'Session expired' });
  }

  // Refresh inactivity timeout
  session.expiresAt = Date.now() + INACTIVITY_TIMEOUT_MS;
  sessions.set(sessionId, session);

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: INACTIVITY_TIMEOUT_MS,
    path: '/',
  });

  req.userId = session.userId;
  next();
}

module.exports = {
  createUserSession,
  requireSession,
  sessions,
};