const crypto = require('crypto');
const express = require('express');

const router = express.Router();

// In-memory session store (use Redis or a database in production)
const sessionStore = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const SESSION_COOKIE_NAME = 'sessionId';

/**
 * Generate a cryptographically random session ID.
 * @returns {string} 256-bit random value, hex-encoded.
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new user session after successful login.
 * Sets an HttpOnly, Secure cookie and returns the session ID.
 *
 * @param {object} res - Express response object.
 * @param {object} user - Authenticated user object (must include an id).
 * @returns {string} The newly created session ID.
 */
function createUserSession(res, user) {
  const sessionId = generateSessionId();
  const now = Date.now();

  const session = {
    userId: user.id,
    createdAt: now,
    lastActivity: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessionStore.set(sessionId, session);

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,               // Not accessible to client-side JS
    secure: true,                 // Only sent over HTTPS
    sameSite: 'strict',           // CSRF mitigation
    maxAge: SESSION_TTL_MS,       // Cookie lifetime (ms)
    path: '/',
  });

  return sessionId;
}

/**
 * Validate and refresh a session on each authenticated request.
 * Sessions expire after 30 minutes of inactivity; each valid request
 * resets the inactivity timer.
 */
function validateSession(req, res, next) {
  const sessionId = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;

  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const session = sessionStore.get(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const now = Date.now();

  if (now > session.expiresAt) {
    sessionStore.delete(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
    return res.status(401).json({ error: 'Session expired' });
  }

  // Refresh inactivity window
  session.lastActivity = now;
  session.expiresAt = now + SESSION_TTL_MS;
  sessionStore.set(sessionId, session);

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });

  req.session = session;
  req.sessionId = sessionId;
  next();
}

/**
 * Destroy a session (e.g., on logout).
 */
function destroySession(req, res) {
  const sessionId = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;
  if (sessionId) {
    sessionStore.delete(sessionId);
  }
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

// Periodically purge expired sessions to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

module.exports = {
  createUserSession,
  validateSession,
  destroySession,
  generateSessionId,
  sessionStore,
};