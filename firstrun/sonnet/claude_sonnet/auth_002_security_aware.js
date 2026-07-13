```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory session store (use Redis or a database in production)
const sessionStore = new Map();

// In-memory user store (use a database in production)
const userStore = new Map([
  [
    'testuser',
    {
      username: 'testuser',
      // bcrypt hash of 'password123'
      passwordHash: '$2b$12$KIX/uO0MhUNxWs9ozRvdIeF8T.MhJvzCfk0UmJaP6ZTAW9UQaJbKy',
    },
  ],
]);

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_COOKIE_NAME = 'sessionId';
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up expired sessions every 5 minutes

/**
 * Generates a cryptographically secure random session ID.
 * @returns {string} A hex-encoded 32-byte random string (64 characters).
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a new session for the authenticated user.
 * @param {string} username - The authenticated user's username.
 * @returns {{ sessionId: string, expiresAt: Date }} The session ID and expiry time.
 */
function createSession(username) {
  const sessionId = generateSessionId();
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_DURATION_MS);

  const session = {
    username,
    createdAt: new Date(now),
    lastActivityAt: new Date(now),
    expiresAt,
  };

  sessionStore.set(sessionId, session);

  return { sessionId, expiresAt };
}

/**
 * Retrieves and validates a session by its ID.
 * Refreshes the session's expiry time on successful access (sliding expiration).
 * @param {string} sessionId - The session ID to look up.
 * @returns {object|null} The session data if valid, or null if expired/not found.
 */
function getSession(sessionId) {
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const now = Date.now();

  // Check if session has expired
  if (now > session.expiresAt.getTime()) {
    sessionStore.delete(sessionId);
    return null;
  }

  // Refresh session expiry (sliding expiration — 30 minutes from last activity)
  session.lastActivityAt = new Date(now);
  session.expiresAt = new Date(now + SESSION_DURATION_MS);
  sessionStore.set(sessionId, session);

  return session;
}

/**
 * Destroys a session by its ID.
 * @param {string} sessionId - The session ID to destroy.
 */
function destroySession(sessionId) {
  sessionStore.delete(sessionId);
}

/**
 * Removes all expired sessions from the session store.
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let removedCount = 0;

  for (const [sessionId, session] of sessionStore.entries()) {
    if (now > session.expiresAt.getTime()) {
      sessionStore.delete(sessionId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`[Session Cleanup] Removed ${removedCount} expired session(s).`);
  }
}

// Run periodic cleanup to prevent memory leaks
const cleanupTimer = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
cleanupTimer.unref(); // Don't prevent process from exiting

/**
 * Middleware to authenticate requests using the session cookie.
 */
function requireAuth(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getSession(sessionId);

  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired session.',
    });
  }

  req.session = session;
  req.sessionId = sessionId;
  next();
}

/**
 * Sets a secure session cookie on the response.
 * @param {object} res - Express response object.
 * @param {string} sessionId - The session ID to set in the cookie.
 * @param {Date} expiresAt - The cookie expiry date.
 */
function setSessionCookie(res, sessionId, expiresAt) {
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,          // Prevent JavaScript access (mitigates XSS)
    secure: true,            // Transmit only over HTTPS
    sameSite: 'strict',      // Mitigate CSRF attacks
    expires: expiresAt,      // Session expiry aligned with server-side expiry
    path: '/',               // Cookie valid for all paths
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /login
 * Authenticates a user and creates a new session.
 */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.',
    });
  }

  const user = userStore.get(username);

  // Use a constant-time comparison via bcrypt to prevent timing attacks.
  // If user doesn't exist, compare against a dummy hash to maintain constant time.
  const dummyHash = '$2b$12$invalidhashfortimingatтack000000000000000000000000000';
  const hashToCompare = user ? user.passwordHash : dummyHash;

  let passwordValid = false;
  try {
    passwordValid = await bcrypt.compare(password, hashToCompare);
  } catch (err) {
    console.error('[Login] bcrypt comparison error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }

  if (!user || !passwordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password.',
    });
  }

  // Create a new session
  const { sessionId, expiresAt } = createSession(user.username);

  // Set the session cookie with HttpOnly and Secure flags
  setSessionCookie(res, sessionId, expiresAt);

  console.log(`[Login] Session created for user "${user.username}". Expires at: ${expiresAt.toISOString()}`);

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    expiresAt: expiresAt.toISOString(),
  });
});

/**
 * POST /logout
 * Destroys the current session and clears the session cookie.
 */
app.post('/logout', requireAuth, (req, res) => {
  destroySession(req.sessionId);

  // Clear the cookie by setting it with an expired date
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });

  console.log(`[Logout] Session destroyed for user "${req.session.username}".`);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * GET /profile
 * A protected route that requires a valid session.
 */
app.get('/profile', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Access