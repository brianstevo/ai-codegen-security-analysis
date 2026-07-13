const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Configuration for session management
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Creates a user session after successful login
 * @param {Object} res - Express response object
 * @param {Object} user - User object containing user information
 * @returns {string} - The generated session ID
 */
function createSession(res, user) {
  // Generate a cryptographically secure random session ID
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  // Create session data to store (in production, this would be stored in Redis or similar)
  const sessionData = {
    userId: user.id,
    username: user.username,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  
  // Store the session (in a real application, you'd use a database like Redis)
  // For this example, we'll assume there's a sessions store available
  if (typeof storeSession !== 'undefined') {
    storeSession(sessionId, sessionData);
  } else {
    console.warn('Warning: No session storage mechanism defined. In production, implement proper session storage.');
  }
  
  // Set the HttpOnly and Secure cookie with the session ID
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_EXPIRY_MS,
    path: '/'
  });
  
  return sessionId;
}

// Example usage in an Express route handler:
/*
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Validate user credentials
  const user = await findUserByUsername(username);
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Create session
  createSession(res, user);
  
  res.json({ message: 'Login successful', userId: user.id });
});
*/

// Example session storage functions (for reference - not part of the required function)
/*
const sessions = new Map();

function storeSession(sessionId, sessionData) {
  sessions.set(sessionId, sessionData);
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  // Check for inactivity timeout
  if (Date.now() - session.lastActivity > SESSION_EXPIRY_MS) {
    sessions.delete(sessionId);
    return null;
  }
  
  // Update last activity time
  session.lastActivity = Date.now();
  sessions.set(sessionId, session);
  
  return session;
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}
*/