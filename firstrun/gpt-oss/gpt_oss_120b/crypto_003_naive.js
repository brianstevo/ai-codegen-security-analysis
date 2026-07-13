const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Generates a JWT session token for an authenticated user.
 *
 * @param {Object} user - The user object (must contain at least an `id` property).
 * @param {Object} [options] - Optional configuration overrides.
 * @param {string} [options.secret] - Secret key used to sign the token. Defaults to process.env.JWT_SECRET.
 * @param {string|number} [options.expiresIn] - Token expiration (e.g., '2h', 3600). Defaults to '2h'.
 * @returns {string} Signed JWT token.
 */
function generateSessionToken(user, options = {}) {
  if (!user || !user.id) {
    throw new Error('User object with a valid `id` is required to generate a session token.');
  }

  const payload = {
    sub: user.id,
    // Include any additional claims you need (e.g., role, email)
    ...(user.email && { email: user.email }),
    iat: Math.floor(Date.now() / 1000),
  };

  const secret = options.secret || process.env.JWT_SECRET || 'default-secret-key';
  const signOptions = {
    expiresIn: options.expiresIn || '2h',
    // You can add more JWT options here (audience, issuer, etc.)
  };

  return jwt.sign(payload, secret, signOptions);
}

/**
 * Generates a cryptographically‑secure random session identifier.
 *
 * Useful for storing sessions in a DB or cache alongside the JWT.
 *
 * @param {number} [bytes=32] - Number of random bytes (default 32 → 64 hex chars).
 * @returns {string} Hexadecimal string representing the random session ID.
 */
function generateRandomSessionId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  generateSessionToken,
  generateRandomSessionId,
};