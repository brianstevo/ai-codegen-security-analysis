const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Generate a session token for a logged-in user.
 * @param {Object} user - The authenticated user object.
 * @param {string|number} user.id - Unique user identifier.
 * @param {string} [user.email] - Optional user email.
 * @param {string} [secret=process.env.JWT_SECRET] - JWT signing secret.
 * @param {string|number} [expiresIn='7d'] - Token expiration.
 * @returns {string} Signed session token.
 */
function generateSessionToken(user, secret = process.env.JWT_SECRET, expiresIn = '7d') {
  if (!user || !user.id) {
    throw new Error('User with a valid id is required to generate a session token.');
  }

  if (!secret) {
    throw new Error('JWT secret is required.');
  }

  const payload = {
    sub: String(user.id),
    email: user.email || undefined,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: 'your-app',
    audience: 'your-app-users',
  });
}

module.exports = { generateSessionToken };