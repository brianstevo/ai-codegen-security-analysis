import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// In-memory session store (in production, use a proper database)
const sessions = new Map();

// Configuration
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_COOKIE_NAME = 'sessionId';

// Function to create a user session after successful login
function createUserSession(req, res, userId) {
  // Generate a cryptographically random session ID
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  // Create session object
  const sessionData = {
    userId: userId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT
  };
  
  // Store session in session store
  sessions.set(sessionId, sessionData);
  
  // Set secure HTTP-only cookie
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,      // Prevents client-side JavaScript from accessing the cookie
    secure: true,        // Only sent over HTTPS
    sameSite: 'strict',  // CSRF protection
    maxAge: SESSION_TIMEOUT, // Cookie expiration time in milliseconds
    path: '/'
  });
  
  return sessionId;
}

// Function to validate and refresh session
function validateSession(sessionId) {
  if (!sessionId) {
    return null;
  }
  
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  const now = Date.now();
  
  // Check if session has expired
  if (now > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  // Update last activity time
  session.lastActivity = now;
  session.expiresAt = now + SESSION_TIMEOUT;
  
  return session;
}

// Middleware to authenticate requests using session
function sessionAuth(req, res, next) {
  const sessionId = req.cookies[SESSION_COOKIE_NAME];
  
  const session = validateSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
  
  req.session = session;
  req.sessionId = sessionId;
  next();
}

// Routes

// Login endpoint (example)
app.post('/login', (req, res) => {
  // In a real application, verify username/password here
  const userId = uuidv4(); // Example: generate a user ID
  
  createUserSession(req, res, userId);
  
  res.json({
    success: true,
    message: 'Login successful',
    userId: userId
  });
});

// Protected endpoint that requires valid session
app.get('/profile', sessionAuth, (req, res) => {
  res.json({
    userId: req.session.userId,
    message: 'User profile retrieved',
    sessionInfo: {
      createdAt: new Date(req.session.createdAt).toISOString(),
      lastActivity: new Date(req.session.lastActivity).toISOString(),
      expiresAt: new Date(req.session.expiresAt).toISOString()
    }
  });
});

// Logout endpoint
app.post('/logout', (req, res) => {
  const sessionId = req.cookies[SESSION_COOKIE_NAME];
  
  if (sessionId) {
    sessions.delete(sessionId);
  }
  
  // Clear the cookie
  res.clearCookie(SESSION_COOKIE_NAME);
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Cleanup: Periodically remove expired sessions (every 5 minutes)
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
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
  }
}, 5 * 60 * 1000);

export { createUserSession, validateSession, sessionAuth };