const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

// In-memory session store (replace with Redis/DB in production)
const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const SESSION_COOKIE_NAME = 'sessionId';

/**
 * Generates a cryptographically random session ID.
 * @returns {string} hex-encoded 256-bit random value
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Serializes a Set-Cookie header value with security flags.
 * @param {string} name
 * @param {string} value
 * @param {number} maxAgeSeconds
 * @returns {string}
 */
function buildSessionCookie(name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${value}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join('; ');
}

/**
 * Creates a new authenticated session for a user and sets the session cookie.
 * @param {object} res - Express response object
 * @param {string|number} userId - Authenticated user's identifier
 * @returns {string} the newly created session ID
 */
function createUserSession(res, userId) {
  const sessionId = generateSessionId();
  const now = Date.now();

  const session = {
    userId,
    createdAt: now,
    lastActivity: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessions.set(sessionId, session);

  res.setHeader(
    'Set-Cookie',
    buildSessionCookie(SESSION_COOKIE_NAME, sessionId, SESSION_TTL_MS / 1000)
  );

  return sessionId;
}

/**
 * Parses the session cookie from the incoming request.
 * @param {object} req
 * @returns {string|null}
 */
function parseSessionCookie(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx === -1) continue;
    const key = cookie.slice(0, eqIdx);
    const val = cookie.slice(eqIdx + 1);
    if (key === SESSION_COOKIE_NAME) return val;
  }
  return null;
}

/**
 * Validates a session and enforces 30-minute inactivity expiry.
 * Refreshes the session sliding window on each valid access.
 * @param {object} req
 * @param {object} res
 * @returns {object|null} the session object if valid, otherwise null
 */
function validateAndRefreshSession(req, res) {
  const sessionId = parseSessionCookie(req);
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session) return null;

  const now = Date.now();

  // Expired due to inactivity
  if (now > session.expiresAt) {
    sessions.delete(sessionId);
    res.setHeader(
      'Set-Cookie',
      buildSessionCookie(SESSION_COOKIE_NAME, '', 0)
    );
    return null;
  }

  // Sliding expiration: reset inactivity timer
  session.lastActivity = now;
  session.expiresAt = now + SESSION_TTL_MS;
  sessions.set(sessionId, session);

  res.setHeader(
    'Set-Cookie',
    buildSessionCookie(SESSION_COOKIE_NAME, sessionId, SESSION_TTL_MS / 1000)
  );

  return session;
}

/**
 * Destroys a session (logout).
 */
function destroySession(req, res) {
  const sessionId = parseSessionCookie(req);
  if (sessionId) sessions.delete(sessionId);
  res.setHeader('Set-Cookie', buildSessionCookie(SESSION_COOKIE_NAME, '', 0));
}

// Periodically purge expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) sessions.delete(id);
  }
}, 5 * 60 * 1000).unref();

// Example usage
app.post('/login', (req, res) => {
  // Assume credentials already verified upstream
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Invalid credentials' });

  createUserSession(res, userId);
  res.json({ message: 'Login successful' });
});

app.get('/protected', (req, res) => {
  const session = validateAndRefreshSession(req, res);
  if (!session) return res.status(401).json({ error: 'Session invalid or expired' });
  res.json({ message: 'Authorized', userId: session.userId });
});

app.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ message: 'Logged out' });
});

module.exports = {
  app,
  createUserSession,
  validateAndRefreshSession,
  destroySession,
  generateSessionId,
};