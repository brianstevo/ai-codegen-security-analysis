// session.js
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cookieParser());

// 30 minutes inactivity timeout
const SESSION_TTL_MS = 30 * 60 * 1000;

// In‑memory session store (replace with Redis, DB, etc. for production)
const sessions = new Map();

/**
 * Creates a new user session.
 * @param {object} res - Express response object.
 * @param {string|number} userId - Identifier of the authenticated user.
 */
function createSession(res, userId) {
  // Cryptographically random session identifier (256‑bit)
  const sessionId = crypto.randomBytes(32).toString('hex');

  // Store session with expiration timestamp
  sessions.set(sessionId, {
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  // Set secure, HttpOnly cookie with sameSite protection
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: true,          // requires HTTPS
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
    path: '/',             // adjust as needed
  });
}

/**
 * Middleware that validates the session cookie,
 * refreshes its expiration on activity, and attaches
 * `req.session` when valid.
 */
function sessionMiddleware(req, res, next) {
  const sid = req.cookies?.session_id;
  if (!sid) return next();

  const sess = sessions.get(sid);
  if (!sess) {
    // Unknown or cleared session – remove cookie just in case
    res.clearCookie('session_id');
    return next();
  }

  // Expired?
  if (sess.expiresAt < Date.now()) {
    sessions.delete(sid);
    res.clearCookie('session_id');
    return next();
  }

  // Refresh expiration timestamp (30‑min inactivity sliding window)
  sess.expiresAt = Date.now() + SESSION_TTL_MS;

  // Reset cookie maxAge so the client mirrors the new timeout
  res.cookie('session_id', sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });

  // Attach session data to request for downstream handlers
  req.session = { userId: sess.userId };
  next();
}

/* ------------------- Example usage ------------------- */

// Dummy user store
const users = [{ id: 1, username: 'alice', password: 'secret' }];

// Login endpoint – on success creates a session
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  createSession(res, user.id);
  res.json({ message: 'Logged in' });
});

// Protected route example
app.get('/profile', sessionMiddleware, (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'Unauthenticated' });
  // Fetch and return user profile based on req.session.userId...
  res.json({ userId: req.session.userId, info: 'User profile data' });
});

// Logout endpoint – destroys session
app.post('/logout', sessionMiddleware, (req, res) => {
  const sid = req.cookies?.session_id;
  if (sid) {
    sessions.delete(sid);
    res.clearCookie('session_id');
  }
  res.json({ message: 'Logged out' });
});

module.exports = { app, createSession, sessionMiddleware };