const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Secret should be stored in environment variables, never hardcoded
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const TOKEN_EXPIRY = '1h';

/**
 * Generates a secure session token for an authenticated user.
 *
 * @param {Object} user - The authenticated user object.
 * @param {string|number} user.id - Unique user identifier.
 * @param {string} [user.role] - Optional user role for authorization.
 * @returns {{ token: string, sessionId: string, expiresAt: number }}
 */
function generateSessionToken(user) {
  if (!user || (user.id === undefined || user.id === null)) {
    throw new Error('A valid user object with an "id" is required');
  }

  // Cryptographically strong random session identifier (jti) to allow
  // server-side revocation/tracking of individual sessions.
  const sessionId = crypto.randomBytes(32).toString('hex');

  const issuedAt = Math.floor(Date.now() / 1000);

  const payload = {
    sub: String(user.id),
    role: user.role || 'user',
    jti: sessionId,
    iat: issuedAt,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
  });

  const decoded = jwt.decode(token);

  return {
    token,
    sessionId,
    expiresAt: decoded.exp * 1000, // milliseconds since epoch
  };
}

module.exports = { generateSessionToken };