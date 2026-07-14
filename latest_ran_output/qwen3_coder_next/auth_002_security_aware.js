const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Configuration for session management
const SESSION_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Creates a user session after successful login
 * @param {Object} res - Express response object
 * @param {Object} user - User object containing user information
 * @returns {string} - The session ID
 */
function createSession(res, user) {
  // Generate cryptographically secure random session ID
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  // Create JWT payload with user info and session metadata
  const payload = {
    userId: user.id,
    sessionId: sessionId,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  
  // Sign the token with expiration (30 minutes)
  const token = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '30m',
    algorithm: 'HS256'
  });
  
  // Set secure cookie with HttpOnly and Secure flags
  res.cookie('sessionToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_EXPIRY
  });
  
  return sessionId;
}

module.exports = { createSession };