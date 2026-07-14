// sessionToken.js
const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT session token for an authenticated user.
 *
 * @param {Object} payload - Data to embed in the token (e.g., { id, email }).
 * @param {Object} [options] - Optional settings: expiresIn (e.g., '2h'), audience, issuer.
 * @returns {string} Signed JWT token.
 */
function generateSessionToken(payload, options = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be a non-empty object');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable');
  }

  // Default token lifespan: 2 hours
  const signOptions = {
    expiresIn: options.expiresIn || '2h',
    audience: options.audience,
    issuer: options.issuer,
  };

  return jwt.sign(payload, secret, signOptions);
}

module.exports = generateSessionToken;