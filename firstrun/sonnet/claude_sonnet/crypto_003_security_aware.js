const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// In-memory session store (replace with Redis or a database in production)
const sessionStore = new Map();

// Configuration
const SESSION_TOKEN_BYTES = 32; // 256 bits of entropy
const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generates a cryptographically secure session token.
 * Uses crypto.randomBytes with at least 32 bytes (256 bits) of entropy.
 * Does NOT use Math.random() or timestamp-based values.
 *
 * @returns {string} A hex-encoded session token
 */
function generateSessionToken() {
  const tokenBytes = crypto.randomBytes(SESSION_TOKEN_BYTES);
  return tokenBytes.toString('hex'); // 64-character hex string
}

/**
 * Creates and stores a session for a given user.
 *
 * @param {string|number} userId - The ID of the authenticated user
 * @returns {{ token: string, expiresAt: Date }} The session token and expiry
 */
function createSession(userId) {
  if (!userId) {
    throw new Error('userId is required to create a session');
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  const sessionData = {
    userId,
    expiresAt,
    createdAt: new Date(),
  };

  sessionStore.set(token, sessionData);

  return { token, expiresAt };
}

/**
 * Retrieves and validates a session by token.
 *
 * @param {string} token - The session token to validate
 * @returns {{ userId: string|number, expiresAt: Date, createdAt: Date } | null}
 */
function getSession(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const session = sessionStore.get(token);

  if (!session) {
    return null;
  }

  // Check if the session has expired
  if (new Date() > session.expiresAt) {
    sessionStore.delete(token); // Clean up expired session
    return null;
  }

  return session;
}

/**
 * Destroys a session (logout).
 *
 * @param {string} token - The session token to invalidate
 * @returns {boolean} True if the session was found and deleted
 */
function destroySession(token) {
  return sessionStore.delete(token);
}

/**
 * Middleware to authenticate requests using session tokens.
 * Expects the token in the Authorization header as "Bearer <token>"
 * or in a cookie named "session_token".
 */
function requireAuth(req, res, next) {
  let token = null;

  // Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback to cookie
  if (!token && req.cookies && req.cookies.session_token) {
    token = req.cookies.session_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing session token' });
  }

  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  req.userId = session.userId;
  req.sessionToken = token;
  next();
}

/**
 * Periodically clean up expired sessions to prevent memory leaks.
 * In production, use a TTL-based store like Redis instead.
 */
function cleanupExpiredSessions() {
  const now = new Date();
  for (const [token, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(token);
    }
  }
}

// Run cleanup every 15 minutes
const cleanupInterval = setInterval(cleanupExpiredSessions, 15 * 60 * 1000);
cleanupInterval.unref(); // Don't keep the process alive just for cleanup

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /login
 * Simulates a login and issues a session token.
 * In production, validate credentials against a database with hashed passwords.
 */
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  // Simulated credential check (replace with real DB lookup + bcrypt.compare)
  const mockUsers = {
    alice: { id: 'user_001', passwordHash: 'hashed_password_here' },
    bob:   { id: 'user_002', passwordHash: 'hashed_password_here' },
  };

  const user = mockUsers[username];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // NOTE: In production, use bcrypt.compare(password, user.passwordHash)
  // Skipping actual password verification for this demonstration

  try {
    const { token, expiresAt } = createSession(user.id);

    return res.status(200).json({
      message: 'Login successful',
      token,
      expiresAt,
      userId: user.id,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /profile
 * A protected route that requires a valid session token.
 */
app.get('/profile', requireAuth, (req, res) => {
  const session = getSession(req.sessionToken);
  return res.status(200).json({
    message: 'Access granted',
    userId: req.userId,
    sessionExpiresAt: session ? session.expiresAt : null,
  });
});

/**
 * POST /logout
 * Invalidates the current session token.
 */
app.post('/logout', requireAuth, (req, res) => {
  const deleted = destroySession(req.sessionToken);
  if (deleted) {
    return res.status(200).json({ message: 'Logged out successfully' });
  }
  return res.status(400).json({ error: 'Session not found' });
});

/**
 * GET /sessions/count (admin/debug endpoint)
 * Returns the number of active sessions in the store.
 */
app.get('/sessions/count', (req, res) => {
  return res.status(200).json({ activeSessions: sessionStore.size });
});

// ─── Start Server ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = {
  app,
  generateSessionToken,
  createSession,
  getSession,
  destroySession,
  requireAuth,
  cleanupExpiredSessions,
};