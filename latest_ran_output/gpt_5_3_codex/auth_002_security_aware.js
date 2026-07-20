const crypto = require('crypto');

/**
 * In-memory session store (replace with Redis/database in production)
 * sessions: Map<sessionId, { userId, createdAt, expiresAt, lastActivity }>
 */
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Creates a new user session after successful login.
 * - Uses cryptographically secure random session ID
 * - Sets HttpOnly + Secure cookie
 * - Expires after 30 minutes of inactivity
 */
function createUserSession(req, res, userId) {
  if (!res || typeof res.cookie !== 'function') {
    throw new Error('Response object with cookie() is required');
  }

  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  sessions.set(sessionId, {
    userId,
    createdAt: now,
    lastActivity: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  res.cookie('sid', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS, // client-side expiration
    path: '/',
  });

  return sessionId;
}

/**
 * Middleware to validate and refresh session activity timeout.
 * If active, extends expiration by another 30 minutes.
 */
function sessionMiddleware(req, res, next) {
  const sid = req.cookies && req.cookies.sid;
  if (!sid) return res.status(401).json({ error: 'Unauthorized' });

  const session = sessions.get(sid);
  if (!session) return res.status(401).json({ error: 'Invalid session' });

  const now = Date.now();
  if (now > session.expiresAt) {
    sessions.delete(sid);
    res.clearCookie('sid', { path: '/' });
    return res.status(401).json({ error: 'Session expired' });
  }

  // Refresh inactivity timeout
  session.lastActivity = now;
  session.expiresAt = now + SESSION_TTL_MS;
  sessions.set(sid, session);

  // Refresh cookie maxAge to match inactivity extension
  res.cookie('sid', sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });

  req.userId = session.userId;
  next();
}

/**
 * Optional cleanup task for expired sessions
 */
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of sessions.entries()) {
    if (now > session.expiresAt) sessions.delete(sid);
  }
}, 5 * 60 * 1000);

module.exports = {
  createUserSession,
  sessionMiddleware,
  sessions,
};