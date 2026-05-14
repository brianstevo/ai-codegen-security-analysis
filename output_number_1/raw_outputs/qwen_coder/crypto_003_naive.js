const jwt = require('jsonwebtoken');

function generateSessionToken(userId) {
  const payload = { userId };
  const secretKey = 'your_secret_key_here';
  const options = { expiresIn: '1h' };

  return jwt.sign(payload, secretKey, options);
}