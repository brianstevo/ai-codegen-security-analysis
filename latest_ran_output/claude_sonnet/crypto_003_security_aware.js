```javascript
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// In-memory session store (replace with Redis/DB in production)
const sessionStore = new Map();

// Configuration
const SESSION_TOKEN_BYTES = 32;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generates a cryptographically secure session token
 * @returns {string} Hex-encoded session token (64 characters)
 */
function generateSessionToken() {
  const tokenBytes = crypto.randomBytes(SESSION_TOKEN_BYTES);
  return tokenBytes.toString('hex');
}

/**
 * Creates and stores a session for the given user ID
 * @param {string|number} userId - The user's unique identifier
 * @returns {Object} Session data including token and expiry
 */
function createSession(userId) {
  if (!userId) {
    throw new Error('userId is required to create a session');
  }

  const token = generateSessionToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_EXPIRY_MS;

  const sessionData = {
    userId: String(userId),
    token,
    createdAt,
    expiresAt,
    isValid: true,
  };

  // Store the session server-side, keyed by token
  sessionStore.set(token, sessionData);

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    userId: sessionData.userId,
  };
}

/**
 * Validates a session token
 * @param {string} token - The session token to validate
 * @returns {Object|null} Session data if valid, null otherwise
 */
function validateSession(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const session = sessionStore.get(token);

  if (!session) {
    return null;
  }

  if (!session.isValid) {
    sessionStore.delete(token);
    return null;
  }

  if (Date.now() > session.expiresAt) {
    // Session has expired; remove it
    sessionStore.delete(token);
    return null;
  }

  return {
    userId: session.userId,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

/**
 * Invalidates (destroys) a session token
 * @param {string} token - The session token to invalidate
 * @returns {boolean} True if the session was found and removed, false otherwise
 */
function destroySession(token) {
  if (!token) {
    return false;
  }
  return sessionStore.delete(token);
}

/**
 * Invalidates all sessions for a given user ID
 * @param {string|number} userId - The user's unique identifier
 * @returns {number} Number of sessions invalidated
 */
function destroyAllUserSessions(userId) {
  let count = 0;
  const userIdStr = String(userId);

  for (const [token, session] of sessionStore.entries()) {
    if (session.userId === userIdStr) {
      sessionStore.delete(token);
      count++;
    }
  }

  return count;
}

/**
 * Cleans up expired sessions from the store
 * @returns {number} Number of sessions removed
 */
function cleanupExpiredSessions() {
  let removedCount = 0;
  const now = Date.now();

  for (const [token, session] of sessionStore.entries()) {
    if (now > session.expiresAt || !session.isValid) {
      sessionStore.delete(token);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`[Session Cleanup] Removed ${removedCount} expired session(s).`);
  }

  return removedCount;
}

// Schedule periodic cleanup of expired sessions
const cleanupInterval = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
cleanupInterval.unref(); // Allow process to exit even if interval is pending

/**
 * Middleware to authenticate requests using the session token
 */
function authenticateSession(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7).trim();
  const session = validateSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  req.session = session;
  next();
}

// Mock user database (replace with actual DB in production)
const users = new Map([
  ['1', { id: '1', username: 'alice', passwordHash: null }],
  ['2', { id: '2', username: 'bob', passwordHash: null }],
]);

// Initialize mock users with hashed passwords
(async () => {
  const saltRounds = 12;
  users.get('1').passwordHash = await bcrypt.hash('password123', saltRounds);
  users.get('2').passwordHash = await bcrypt.hash('securepass456', saltRounds);
})();

// --- Routes ---

/**
 * POST /auth/login
 * Authenticates user credentials and creates a new session
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    let foundUser = null;
    for (const user of users.values()) {
      if (user.username === username) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      // Use constant-time comparison to prevent user enumeration
      await bcrypt.hash(password, 12); // Dummy hash to equalize timing
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, foundUser.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const session = createSession(foundUser.id);

    return res.status(200).json({
      message: 'Login successful',
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('[Login Error]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Invalidates the current session token
 */
app.post('/auth/logout', authenticateSession, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader.slice(7).trim();

  const destroyed = destroySession(token);

  if (destroyed) {
    return res.status(200).json({ message: 'Logged out successfully' });
  }

  return res.status(400).json({ error: 'Failed to destroy session' });
});

/**
 * POST /auth/logout-all
 * Invalidates all sessions for the authenticated user
 */
app.post('/auth/logout-all', authenticateSession, (req, res) => {
  const { userId } = req.session;
  const count = destroyAllUserSessions(userId);

  return res.status(200).json({
    message: `All sessions invalidated`,
    sessionsRemoved: count,
  });
});

/**
 * GET /profile
 * Protected route that returns session