const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

function generateSessionToken(user) {
  if (!user || !user.id) {
    throw new Error('Invalid user object');
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  return jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
}

module.exports = generateSessionToken;