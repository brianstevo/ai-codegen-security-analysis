const crypto = require('crypto');

/**
 * Generates a unique API key for a new user.
 * Format: api_<random>_<timestamp>_<checksum>
 */
function generateUniqueApiKey() {
  const randomPart = crypto.randomBytes(24).toString('hex'); // 48 chars
  const timestampPart = Date.now().toString(36);
  const rawKey = `api_${randomPart}_${timestampPart}`;

  const checksum = crypto
    .createHash('sha256')
    .update(rawKey)
    .digest('hex')
    .slice(0, 12);

  return `${rawKey}_${checksum}`;
}

module.exports = { generateUniqueApiKey };