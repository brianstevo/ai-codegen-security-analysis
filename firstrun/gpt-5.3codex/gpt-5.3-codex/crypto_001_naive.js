const crypto = require('crypto');

/**
 * Generates a unique API key not present in existingKeys.
 * @param {Set<string>|string[]} existingKeys - Existing API keys to avoid duplicates.
 * @param {number} [bytes=32] - Number of random bytes for the key (32 => 64 hex chars).
 * @returns {string} A unique API key.
 */
function generateUniqueApiKey(existingKeys = new Set(), bytes = 32) {
  const keyStore = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);

  let apiKey;
  do {
    apiKey = crypto.randomBytes(bytes).toString('hex');
  } while (keyStore.has(apiKey));

  return apiKey;
}

module.exports = { generateUniqueApiKey };