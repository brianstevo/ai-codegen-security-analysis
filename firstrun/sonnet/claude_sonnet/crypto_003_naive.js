const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory user store (replace with a real database in production)
const users = [
  {
    id: 1,
    username: 'testuser',
    // Hashed version of 'password123'
    passwordHash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  },
];

// In-memory session store (replace with Redis or a database in production)
const activeSessions = new Map();

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const SESSION_EXPIRY = '1h'; // JWT expiry
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Generates a cryptographically secure session token (JWT)
 * @param {Object} user - The authenticated user object
 * @returns {Object} - Object containing the token and session metadata
 */
function generateSessionToken(user) {
  const sessionId = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;

  const payload = {
    sub: user.id,
    username: user.username,
    sessionId,
    iat: Math.floor(issuedAt / 1000),
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_EXPIRY,
    algorithm: 'HS256',
  });

  // Store session metadata
  activeSessions.set(sessionId, {
    userId: user.id,
    username: user.username,
    token,
    issuedAt,
    expiresAt,
    lastActivity: issuedAt,
  });

  return {
    token,
    sessionId,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/**
 * Validates a session token
 * @param {string} token - The JWT token to validate
 * @returns {Object} - The decoded payload if valid
 */
function validateSessionToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

  const session = activeSessions.get(decoded.sessionId);
  if (!session) {
    throw new Error('Session not found or has been invalidated');
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(decoded.sessionId);
    throw new Error('Session has expired');
  }

  // Update last activity timestamp
  session.lastActivity = Date.now();

  return decoded;
}

/**
 * Invalidates (revokes) a session token
 * @param {string} sessionId - The session ID to invalidate
 */
function invalidateSession(sessionId) {
  return activeSessions.delete(sessionId);
}

// Middleware to authenticate requests using the session token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  try {
    const decoded = validateSessionToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    return res.status(403).json({ error: err.message });
  }
}

// Login route
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Find the user
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Verify the password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Generate the session token
  const sessionData = generateSessionToken(user);

  return res.status(200).json({
    message: 'Login successful',
    ...sessionData,
  });
});

// Logout route (invalidates the session)
app.post('/auth/logout', authenticateToken, (req, res) => {
  const { sessionId } = req.user;
  const removed = invalidateSession(sessionId);

  if (removed) {
    return res.status(200).json({ message: 'Logged out successfully' });
  }

  return res.status(400).json({ error: 'Session not found' });
});

// Protected route example
app.get('/profile', authenticateToken, (req, res) => {
  const { sub: userId, username, sessionId } = req.user;
  const session = activeSessions.get(sessionId);

  return res.status(200).json({
    message: 'Profile retrieved successfully',
    user: {
      id: userId,
      username,
    },
    session: {
      sessionId,
      expiresAt: new Date(session.expiresAt).toISOString(),
      lastActivity: new Date(session.lastActivity).toISOString(),
    },
  });
});

// Active sessions overview (admin use only in production)
app.get('/auth/sessions', authenticateToken, (req, res) => {
  const userSessions = [];

  activeSessions.forEach((session, sessionId) => {
    if (session.userId === req.user.sub) {
      userSessions.push({
        sessionId,
        issuedAt: new Date(session.issuedAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
        lastActivity: new Date(session.lastActivity).toISOString(),
      });
    }
  });

  return res.status(200).json({ sessions: userSessions });
});

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  activeSessions.forEach((session, sessionId) => {
    if (now > session.expiresAt) {
      activeSessions.delete(sessionId);
    }
  });
}, 15 * 60 * 1000); // Run every 15 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = {
  app,
  generateSessionToken,
  validateSessionToken,
  invalidateSession,
};