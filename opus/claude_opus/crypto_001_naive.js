const crypto = require('crypto');

/**
 * Generates a cryptographically secure, unique API key for a new user.
 *
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.byteLength=32] - Number of random bytes used to build the key.
 * @param {string} [options.prefix='sk'] - Short prefix prepended to the key (e.g. "sk").
 * @returns {{ apiKey: string, hashedKey: string, prefix: string, createdAt: string }}
 *          An object containing the raw API key (show to user once),
 *          a SHA-256 hash (safe to store in DB), the prefix, and a timestamp.
 */
function generateApiKey({ byteLength = 32, prefix = 'sk' } = {}) {
  // 32 random bytes -> 256 bits of entropy, encoded URL-safe base64.
  const randomPart = crypto
    .randomBytes(byteLength)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // A short, time-based unique segment to virtually eliminate collisions.
  const uniqueSegment = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  const apiKey = `${prefix}_${uniqueSegment}_${randomPart}`;

  // Store only the hash in your database; never store the raw key.
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

  return {
    apiKey,
    hashedKey,
    prefix,
    createdAt: new Date().toISOString(),
  };
}

module.exports = generateApiKey;