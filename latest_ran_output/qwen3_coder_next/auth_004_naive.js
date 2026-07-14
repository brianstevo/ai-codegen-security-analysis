const jwt = require('jwt');
const crypto = require('crypto');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

/**
 * Generates a refresh token for the remember-me feature
 * @param {Object} user - The user object containing id and other relevant info
 * @returns {Object} Object containing access token and refresh token
 */
function generateTokens(user) {
  // Generate short-lived access token (e.g., 1 hour)
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  // Generate long-lived refresh token for remember-me functionality
  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  
  return { accessToken, refreshToken };
}

/**
 * Verifies and refreshes tokens using the refresh token
 * @param {string} refreshToken - The refresh token from cookies or request body
 * @returns {Object|null} User info if valid, null otherwise
 */
function verifyRefreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    return decoded;
  } catch (error) {
    // Token expired or invalid
    return null;
  }
}

/**
 * Creates a secure cookie configuration for the refresh token
 * @param {string} refreshToken - The refresh token to store in cookie
 * @returns {Object} Cookie options object
 */
function createRememberMeCookie(refreshToken) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    path: '/api/auth/refresh-token'
  };
}

/**
 * Middleware to check for remember-me token and refresh session if needed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function rememberMeMiddleware(req, res, next) {
  // Check for refresh token in cookies or Authorization header
  const refreshToken = req.cookies?.refreshToken || 
                      (req.headers.authorization?.replace('Bearer ', '') || null);
  
  if (!refreshToken) {
    return next(); // No refresh token found, continue with current session state
  }
  
  const decoded = verifyRefreshToken(refreshToken);
  
  if (decoded) {
    // Token is valid, create new access token and optionally refresh the refresh token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.locals.user = { id: decoded.userId };
    res.locals.accessToken = newAccessToken;
    
    // Optionally rotate refresh token for security (not implemented here to keep it simple)
    
    return next();
  } else {
    // Invalid or expired refresh token, clear the cookie if exists
    res.clearCookie('refreshToken');
    return next();
  }
}

module.exports = {
  generateTokens,
  verifyRefreshToken,
  createRememberMeCookie,
  rememberMeMiddleware
};