import express from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory session store (in production, use Redis or database)
const sessions = new Map();

// Session configuration constants
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_ID_LENGTH = 32; // 32 bytes for cryptographic randomness

/**
 * Creates a user session after successful login
 * @param {Object} user - The user object containing id and email
 * @param {Object} req - The Express request object
 * @param {Object} res - The Express response object
 * @returns {Object} The session data
 */
function createUserSession(user, req, res) {
  // Generate cryptographically random session ID
  const sessionId = crypto.randomBytes(SESSION_ID_LENGTH).toString('hex');

  // Create session object
  const sessionData = {
    userId: user.id,
    email: user.email,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION
  };

  // Store session in memory (in production, use persistent storage)
  sessions.set(sessionId, sessionData);

  // Set secure session cookie
  // HttpOnly: prevents JavaScript access to the cookie
  // Secure: only sent over HTTPS
  // SameSite: prevents CSRF attacks
  // MaxAge: 30 minutes in milliseconds
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION,
    path: '/'
  });

  return {
    sessionId,
    userId: user.id,
    email: user.email,
    expiresIn: SESSION_DURATION
  };
}

/**
 * Validates and retrieves session from cookie
 * Automatically destroys expired sessions
 * @param {Object} req - The Express request object
 * @returns {Object|null} The session data if valid, null otherwise
 */
function getValidSession(req) {
  const sessionId = req.cookies.sessionId;

  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  // Update last activity timestamp
  session.lastActivity = Date.now();

  return session;
}

/**
 * Destroys a user session (logout)
 * @param {Object} req - The Express request object
 * @param {Object} res - The Express response object
 */
function destroySession(req, res) {
  const sessionId = req.cookies.sessionId;

  if (sessionId) {
    sessions.delete(sessionId);
  }

  res.clearCookie('sessionId', { path: '/' });
}

/**
 * Middleware to validate session
 */
function validateSessionMiddleware(req, res, next) {
  const session = getValidSession(req);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized - Invalid or expired session' });
  }

  // Attach session to request object
  req.session = session;
  next();
}

/**
 * Clean up expired sessions periodically
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// Example routes for testing

// Mock user database
const users = new Map([
  [1, { id: 1, email: 'user@example.com', password: 'hashed_password_here' }]
]);

/**
 * Login route - demonstrates session creation
 */
app.post('/login', (req, res) => {
  // In a real application, verify password using bcrypt
  const user = users.get(1);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create session
  const sessionInfo = createUserSession(user, req, res);

  res.json({
    message: 'Login successful',
    session: sessionInfo
  });
});

/**
 * Protected route - requires valid session
 */
app.get('/protected', validateSessionMiddleware, (req, res) => {
  res.json({
    message: 'Access granted to protected resource',
    userId: req.session.userId,
    email: req.session.email
  });
});

/**
 * Logout route
 */
app.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ message: 'Logout successful' });
});

/**
 * Session info route - for testing
 */
app.get('/session-info', (req, res) => {
  const session = getValidSession(req);

  if (!session) {
    return res.status(401).json({ error: 'No active session' });
  }

  res.json({
    userId: session.userId,
    email: session.email,
    createdAt: new Date(session.createdAt),
    lastActivity: new Date(session.lastActivity),
    expiresAt: new Date(session.expiresAt),
    remainingTime: Math.max(0, session.expiresAt - Date.now())
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Test the session system:');
  console.log(`1. POST http://localhost:${PORT}/login - Create a session`);
  console.log(`2. GET http://localhost:${PORT}/session-info - View session info`);
  console.log(`3. GET http://localhost:${PORT}/protected - Access protected resource`);
  console.log(`4. POST http://localhost:${PORT}/logout - Destroy session`);
});