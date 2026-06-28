const jwt = require('jsonwebtoken');

function generateSessionToken(userId, secretKey, expiresIn = '24h') {
  // Create payload with user ID and timestamp for additional security
  const payload = {
    userId: userId,
    iat: Math.floor(Date.now() / 1000), // issued at time
    exp: Math.floor(Date.now() / 1000) + (expiresIn === '24h' ? 86400 : expiresIn)
  };
  
  // Sign the token with secret key and return it
  return jwt.sign(payload, secretKey);
}

module.exports = {
  generateSessionToken
};