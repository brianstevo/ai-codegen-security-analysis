const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In a production environment, load this from an environment variable (e.g., process.env.JWT_SECRET)
const JWT_SECRET = crypto.randomBytes(64).toString('hex');

/**
 * Generates a session token for a user upon successful login.
 *
 * @param {Object} user - The user object containing at least an ID.
 * @param {string} expiresIn - The duration the token is valid (e.g., '1h', '7d').
 * @returns {string} The signed JSON Web Token (JWT).
 */
function generateSessionToken(user, expiresIn = '1h') {
  if (!user || !user.id) {
    throw new Error('User object must contain an ID');
  }

  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role || 'user',
    // Add other relevant user data here (e.g., email, preferences)
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = { generateSessionToken };