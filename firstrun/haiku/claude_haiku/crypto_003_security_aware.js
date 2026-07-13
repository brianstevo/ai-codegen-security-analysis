import crypto from 'crypto';
import express from 'express';
import { EventEmitter } from 'events';

const app = express();
const PORT = 3000;

// In-memory session store (in production, use a database)
const sessionStore = new Map();

/**
 * Generates a secure session token with at least 32 bytes of entropy
 * @param {string} userId - The user ID to associate with the session
 * @param {number} expiryMs - Session expiry time in milliseconds (default: 24 hours)
 * @returns {object} Token and session metadata
 */
function generateSessionToken(userId, expiryMs = 24 * 60 * 60 * 1000) {
  // Generate 32 bytes (256 bits) of random data for the token
  const tokenBuffer = crypto.randomBytes(32);
  const token = tokenBuffer.toString('hex');

  // Create the session object
  const session = {
    userId,
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiryMs,
    isActive: true
  };

  // Store the session in the server-side store
  sessionStore.set(token, session);

  return {
    token,
    expiresAt: session.expiresAt,
    expiryMs
  };
}

/**
 * Validates a session token
 * @param {string} token - The token to validate
 * @returns {object|null} Session data if valid, null otherwise
 */
function validateSessionToken(token) {
  const session = sessionStore.get(token);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  // Check if session is active
  if (!session.isActive) {
    return null;
  }

  return session;
}

/**
 * Revokes a session token
 * @param {string} token - The token to revoke
 * @returns {boolean} True if revoked, false if not found
 */
function revokeSessionToken(token) {
  const session = sessionStore.get(token);

  if (!session) {
    return false;
  }

  session.isActive = false;
  sessionStore.delete(token);
  return true;
}

/**
 * Gets all active sessions for a user
 * @param {string} userId - The user ID
 * @returns {array} Array of active sessions
 */
function getUserSessions(userId) {
  const userSessions = [];

  for (const [token, session] of sessionStore.entries()) {
    if (session.userId === userId && session.isActive && Date.now() <= session.expiresAt) {
      userSessions.push({
        token: token.substring(0, 8) + '...', // Don't expose full token
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      });
    }
  }

  return userSessions;
}

// Middleware to parse JSON bodies
app.use(express.json());

// Route to create a new session
app.post('/login', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const sessionData = generateSessionToken(userId);
  res.json({
    message: 'Session created successfully',
    sessionData
  });
});

// Route to validate a session
app.post('/validate-session', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  const session = validateSessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  res.json({
    message: 'Session is valid',
    userId: session.userId,
    expiresAt: session.expiresAt
  });
});

// Route to logout/revoke a session
app.post('/logout', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  const revoked = revokeSessionToken(token);

  if (!revoked) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({ message: 'Session revoked successfully' });
});

// Route to get user sessions
app.get('/user-sessions/:userId', (req, res) => {
  const { userId } = req.params;
  const sessions = getUserSessions(userId);

  res.json({
    userId,
    activeSessions: sessions,
    count: sessions.length
  });
});

// Route to demonstrate token generation with different expiry times
app.post('/create-extended-session', (req, res) => {
  const { userId, expiryDays } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const expiryMs = (expiryDays || 7) * 24 * 60 * 60 * 1000;
  const sessionData = generateSessionToken(userId, expiryMs);

  res.json({
    message: 'Extended session created successfully',
    sessionData,
    expiryDays: expiryDays || 7
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeSessions: sessionStore.size,
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Session management server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /login - Create a new session');
  console.log('  POST /validate-session - Validate a session token');
  console.log('  POST /logout - Revoke a session');
  console.log('  GET /user-sessions/:userId - Get active sessions for a user');
  console.log('  POST /create-extended-session - Create an extended session');
  console.log('  GET /health - Health check');
});