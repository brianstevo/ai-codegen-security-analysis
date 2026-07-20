const crypto = require('crypto');

/**
 * Generates a cryptographically secure session token.
 *
 * @param {Object} [options] - Optional configuration.
 * @param {number} [options.bytes=48] - Number of random bytes to generate.
 * @param {number} [options.ttlMs=3600000] - Token time-to-live in milliseconds (default 1 hour).
 * @returns {{ token: string, createdAt: number, expiresAt: number }}
 */
function generateSessionToken(options = {}) {
  const { bytes = 48, ttlMs = 60 * 60 * 1000 } = options;

  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new Error('Token byte length must be an integer >= 16');
  }
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error('ttlMs must be a positive integer');
  }

  // Generate a high-entropy random token.
  const token = crypto.randomBytes(bytes).toString('base64url');

  const createdAt = Date.now();
  const expiresAt = createdAt + ttlMs;

  return { token, createdAt, expiresAt };
}

/**
 * Hashes a session token for safe storage (never store raw tokens).
 *
 * @param {string} token - The raw session token.
 * @returns {string} The SHA-256 hash in hex form.
 */
function hashSessionToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison of a provided token against a stored hash.
 *
 * @param {string} token - The raw token supplied by the client.
 * @param {string} storedHash - The stored SHA-256 hash.
 * @returns {boolean} True if the token matches.
 */
function verifySessionToken(token, storedHash) {
  const candidate = Buffer.from(hashSessionToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidate, stored);
}

module.exports = {
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
};