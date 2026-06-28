const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// In-memory storage for tokens (in production, use Redis or similar)
const rememberMeTokens = new Map();

// Configuration
const TOKEN_EXPIRY_HOURS = 30;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const COOKIE_NAME = 'remember_me';

/**
 * Generate a secure random token
 */
function generateToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Create a remember-me token for a user and set the cookie
 * @param {Object} res - Express response object
 * @param {Object} user - User object (should contain at least id)
 * @returns {Promise<string>} - The generated token
 */
async function createRememberMeToken(res, user) {
  // Generate a secure random token
  const token = generateToken();
  
  // Create JWT payload with user info and expiration time
  const payload = {
    userId: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (TOKEN_EXPIRY_HOURS * 3600)
  };
  
  // Sign the JWT
  const jwtToken = jwt.sign(payload, JWT_SECRET);
  
  // Store token mapping server-side with expiration time
  const expiryTime = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000); // 30 days from now
  
  // Use a Map to store the mapping between the random token and JWT
  rememberMeTokens.set(token, {
    jwt: jwtToken,
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: expiryTime
  });
  
  // Set cookie with secure attributes
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,           // Prevent JavaScript access to the cookie
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    sameSite: 'Strict',       // Prevent CSRF attacks
    maxAge: TOKEN_EXPIRY_HOURS * 60 * 60 * 1000, // Match server-side expiry
    path: '/'                // Available across the entire domain
  });
  
  return token;
}

/**
 * Validate and rotate a remember-me token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object|null>} - User info if valid, null otherwise
 */
async function validateAndRotateRememberMeToken(req, res) {
  const token = req.cookies[COOKIE_NAME];
  
  // Check if token exists in our store
  if (!token || !rememberMeTokens.has(token)) {
    return null;
  }
  
  const storedData = rememberMeTokens.get(token);
  
  // Check if token has expired
  if (Date.now() > storedData.expiresAt) {
    rememberMeTokens.delete(token);
    res.clearCookie(COOKIE_NAME);
    return null;
  }
  
  try {
    // Verify the JWT to ensure it's valid and hasn't been tampered with
    const decoded = jwt.verify(storedData.jwt, JWT_SECRET);
    
    // Token rotation: generate a new token for next request
    await createRememberMeToken(res, { id: decoded.userId, email: decoded.email });
    
    // Remove the old token from storage (since we've created a new one)
    rememberMeTokens.delete(token);
    
    return {
      userId: decoded.userId,
      email: decoded.email
    };
  } catch (error) {
    // If JWT verification fails, remove the token and clear cookie
    if (token && rememberMeTokens.has(token)) {
      rememberMeTokens.delete(token);
      res.clearCookie(COOKIE_NAME);
    }
    return null;
  }
}

/**
 * Clear a remember-me token (for logout)
 * @param {Object} res - Express response object
 */
function clearRememberMeToken(res) {
  // Get all tokens associated with the current session/user if needed
  // For now, we'll just clear the cookie and remove any matching tokens
  const token = res.req.cookies[COOKIE_NAME];
  
  if (token && rememberMeTokens.has(token)) {
    rememberMeTokens.delete(token);
  }
  
  res.clearCookie(COOKIE_NAME);
}

module.exports = {
  createRememberMeToken,
  validateAndRotateRememberMeToken,
  clearRememberMeToken
};