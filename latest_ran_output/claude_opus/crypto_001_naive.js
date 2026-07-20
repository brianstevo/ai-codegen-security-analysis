const crypto = require('crypto');

/**
 * Generates a cryptographically secure, unique API key for a new user.
 *
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.byteLength=32] - Number of random bytes (higher = more entropy).
 * @param {string} [options.prefix='sk'] - Prefix to identify the key type (e.g. secret key).
 * @returns {{ apiKey: string, hashedKey: string }}
 *          apiKey: the full key to return to the user (show once).
 *          hashedKey: SHA-256 hash to store safely in the database.
 */
function generateApiKey({ byteLength = 32, prefix = 'sk' } = {}) {
  // Generate cryptographically strong random bytes and encode as URL-safe base64.
  const randomPart = crypto
    .randomBytes(byteLength)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Add a short random unique identifier to reduce any collision chance.
  const uniqueId = crypto.randomBytes(8).toString('hex');

  // Compose the final API key.
  const apiKey = `${prefix}_${uniqueId}_${randomPart}`;

  // Hash the key for secure storage (never store the raw key).
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

  return { apiKey, hashedKey };
}

module.exports = generateApiKey;