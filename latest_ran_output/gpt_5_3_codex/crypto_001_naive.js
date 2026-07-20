const crypto = require('crypto');

/**
 * Generates a unique API key for a new user.
 * @param {Set<string>|string[]} [existingKeys=[]] - Existing keys to avoid collisions.
 * @returns {string} A unique API key.
 */
function generateUniqueApiKey(existingKeys = []) {
  const keySet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);

  let apiKey;
  do {
    // 32 bytes => 64 hex chars
    apiKey = crypto.randomBytes(32).toString('hex');
  } while (keySet.has(apiKey));

  return apiKey;
}

module.exports = { generateUniqueApiKey };