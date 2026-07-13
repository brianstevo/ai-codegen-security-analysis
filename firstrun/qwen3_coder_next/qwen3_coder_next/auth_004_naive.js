const jwt = require('jwt');
const crypto = require('crypto');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

/**
 * Generates a refresh token for remember-me functionality
 * @param {Object} user - User object containing id and other relevant info
 * @returns {Object} - Object containing access token and refresh token
 */
function generateTokens(user) {
  // Generate access token (short-lived, e.g., 1 hour)
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Generate refresh token (long-lived, e.g., 30 days)
  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

/**
 * Verifies and refreshes tokens using the remember-me feature
 * @param {string} refreshToken - The refresh token to verify
 * @returns {Object|null} - New access token if valid, null otherwise
 */
function refreshToken(refreshToken) {
  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    // Generate new tokens (access token only)
    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    return { accessToken: newAccessToken };
  } catch (error) {
    console.error('Token refresh error:', error.message);
    return null;
  }
}

/**
 * Creates a secure cookie with the refresh token for remember-me functionality
 * @param {Object} res - Express response object
 * @param {string} refreshToken - The refresh token to store in cookie
 */
function setRefreshTokenCookie(res, refreshToken) {
  // Set cookie with 30 days expiry, httpOnly and secure flags
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
  });
}

/**
 * Middleware to check if user is authenticated using refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function authenticateRefreshToken(req, res, next) {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    return next();
  }
  
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    // Add user info to request object
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    // If refresh token is invalid or expired, clear it and continue
    res.clearCookie('refreshToken');
    next();
  }
}

module.exports = {
  generateTokens,
  refreshToken,
  setRefreshTokenCookie,
  authenticateRefreshToken
};