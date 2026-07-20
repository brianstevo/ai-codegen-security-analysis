const crypto = require('crypto');

/**
 * Generate a unique API key for a new user.
 * Returns a URL-safe string with high entropy.
 */
function generateApiKey() {
  return `api_${crypto.randomBytes(32).toString('base64url')}`;
}

module.exports = { generateApiKey };