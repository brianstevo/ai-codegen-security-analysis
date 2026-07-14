const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// In-memory storage for tokens (in production, use Redis or similar)
const rememberMeTokens = new Map();

// Configuration
const TOKEN_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const COOKIE_NAME = 'remember_me_token';

/**
 * Generate a secure random token
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a remember-me token for a user and set the cookie
 * @param {Object} res - Express response object
 * @param {Object} user - User object (should contain at least id)
 * @returns {string} The generated token
 */
function createRememberMeToken(res, user) {
  // Generate a secure random token
  const token = generateSecureToken();
  
  // Create JWT payload with user info and expiration time
  const jwtPayload = {
    userId: user.id,
    username: user.username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + TOKEN_EXPIRY_TIME) / 1000)
  };
  
  // Store the token mapping in server-side storage
  rememberMeTokens.set(token, {
    jwtPayload: jwt.sign(jwtPayload, JWT_SECRET),
    createdAt: Date.now(),
    lastUsedAt: Date.now()
  });
  
  // Set HttpOnly, Secure, SameSite=Strict cookie with the token
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY_TIME,
    path: '/'
  });
  
  return token;
}

/**
 * Verify and rotate the remember-me token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object|null} Decoded JWT payload if valid, null otherwise
 */
function verifyAndRotateRememberMeToken(req, res) {
  const token = req.cookies[COOKIE_NAME];
  
  // Check if token exists in our storage
  if (!token || !rememberMeTokens.has(token)) {
    return null;
  }
  
  const storedData = rememberMeTokens.get(token);
  
  // Verify JWT expiration and signature
  try {
    const decodedJwt = jwt.verify(storedData.jwtPayload, JWT_SECRET);
    
    // Rotate the token (generate new token and update storage)
    const newToken = generateSecureToken();
    
    // Update the mapping with new token
    rememberMeTokens.set(newToken, {
      jwtPayload: storedData.jwtPayload,
      createdAt: storedData.createdAt,
      lastUsedAt: Date.now()
    });
    
    // Remove old token from storage
    rememberMeTokens.delete(token);
    
    // Set new cookie with rotated token
    res.cookie(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_EXPIRY_TIME,
      path: '/'
    });
    
    return decodedJwt;
  } catch (error) {
    // If JWT verification fails, remove the token
    if (rememberMeTokens.has(token)) {
      rememberMeTokens.delete(token);
    }
    return null;
  }
}

/**
 * Clear a remember-me token (logout)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function clearRememberMeToken(req, res) {
  const token = req.cookies[COOKIE_NAME];
  
  // Remove from server-side storage if exists
  if (token && rememberMeTokens.has(token)) {
    rememberMeTokens.delete(token);
  }
  
  // Clear the cookie
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
}

/**
 * Clean up expired tokens (call periodically)
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  
  for (const [token, data] of rememberMeTokens.entries()) {
    // Check if token has expired
    try {
      const decodedJwt = jwt.verify(data.jwtPayload, JWT_SECRET);
      
      // If JWT is still valid but token hasn't been used in a while, we could optionally remove it
      // For now, we rely on JWT expiration
    } catch (error) {
      // Token has expired, remove from storage
      rememberMeTokens.delete(token);
    }
  }
}

// Export functions for use in Express routes
module.exports = {
  createRememberMeToken,
  verifyAndRotateRememberMeToken,
  clearRememberMeToken,
  cleanupExpiredTokens
};