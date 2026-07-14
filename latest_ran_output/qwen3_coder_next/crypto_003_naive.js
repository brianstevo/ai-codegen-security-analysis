const jwt = require('jsonwebtoken');

function generateSessionToken(userId, secretKey, expiresIn = '24h') {
  // Create payload with user ID and timestamp for additional security
  const payload = {
    userId: userId,
    iat: Math.floor(Date.now() / 1000)
  };
  
  // Generate JWT token
  return jwt.sign(payload, secretKey, { expiresIn });
}

module.exports = generateSessionToken;