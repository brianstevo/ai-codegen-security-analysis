```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory session store (replace with Redis or database in production)
const sessions = new Map();

// In-memory user store (replace with database in production)
const users = new Map([
  [
    'testuser',
    {
      id: '1',
      username: 'testuser',
      // bcrypt hash of 'password123'
      passwordHash: '$2b$12$KIXtbBsBzVwmGT3bB8p7T.AjVFj9hKqHbBXQ3BhLOGJvzB0Y0mUbS',
    },
  ],
]);

const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_COOKIE_NAME = 'sessionId';

/**
 * Generates a cryptographically random session ID
 * @returns {string} A 64-character hex string
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a new session for the given user
 * @param {string} userId - The user's unique identifier
 * @param {string} username - The user's username
 * @returns {object} Session object containing sessionId and expiry
 */
function createSession(userId, username) {
  const sessionId = generateSessionId();
  const now = Date.now();
  const expiresAt = now + SESSION_EXPIRY_MS;

  const session = {
    sessionId,
    userId,
    username,
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
  };

  sessions.set(sessionId, session);

  return session;
}

/**
 * Validates a session and refreshes its expiry on activity
 * @param {string} sessionId - The session ID to validate
 * @returns {object|null} The session object if valid, null otherwise
 */
function validateAndRefreshSession(sessionId) {
  if (!sessionId) return null;

  const session = sessions.get(sessionId);

  if (!session) return null;

  const now = Date.now();

  // Check if session has expired due to inactivity
  if (now > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  // Refresh session expiry on activity (sliding window)
  session.lastActivityAt = now;
  session.expiresAt = now + SESSION_EXPIRY_MS;
  sessions.set(sessionId, session);

  return session;
}

/**
 * Destroys a session
 * @param {string} sessionId - The session ID to destroy
 */
function destroySession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Sets the session cookie with security flags
 * @param {object} res - Express response object
 * @param {string} sessionId - The session ID to set in the cookie
 */
function setSessionCookie(res, sessionId) {
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,         // Prevent JavaScript access (mitigates XSS)
    secure: true,           // Only send over HTTPS
    sameSite: 'strict',     // Prevent CSRF attacks
    maxAge: SESSION_EXPIRY_MS, // Cookie expiry in milliseconds
    path: '/',
  });
}

/**
 * Clears the session cookie
 * @param {object} res - Express response object
 */
function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Middleware to authenticate requests using session cookies
 */
function requireAuth(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const session = validateAndRefreshSession(sessionId);

  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid. Please log in again.',
    });
  }

  // Refresh the cookie expiry to match the refreshed session
  setSessionCookie(res, sessionId);

  req.session = session;
  next();
}

// Cleanup expired sessions periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired session(s)`);
  }
}, 5 * 60 * 1000);

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /login
 * Authenticates the user and creates a session
 */
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    // Look up the user
    const user = users.get(username);

    if (!user) {
      // Use a generic message to avoid username enumeration
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Verify password using bcrypt (constant-time comparison)
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Invalidate any existing session for this user (optional: enforce single session)
    for (const [sessionId, session] of sessions.entries()) {
      if (session.userId === user.id) {
        sessions.delete(sessionId);
      }
    }

    // Create a new session
    const session = createSession(user.id, user.username);

    // Set the secure session cookie
    setSessionCookie(res, session.sessionId);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
      },
      session: {
        expiresAt: new Date(session.expiresAt).toISOString(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred',
    });
  }
});

/**
 * POST /logout
 * Destroys the user's session
 */
app.post('/logout', (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (sessionId) {
    destroySession(sessionId);
  }

  clearSessionCookie(res);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /profile
 * Protected route - requires valid session
 */
app.get('/profile', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.session.userId,
      username: req.session.username,
    },
    session: {
      createdAt: new Date(req.session.cre