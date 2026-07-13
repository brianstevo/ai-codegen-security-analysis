const crypto = require('crypto');

/**
 * Generates a cryptographically secure API key.
 * @returns {Object} An object containing the plaintext key and its SHA-256 hash.
 */
function generateApiKey() {
  // Generate 32 bytes of random data
  const rawBytes = crypto.randomBytes(32);

  // Encode as hex string (32 bytes = 64 hex characters)
  const apiKey = rawBytes.toString('hex');

  // Generate a SHA-256 hash for secure storage
  const storedHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Return the plaintext key and the hash
  return {
    apiKey: apiKey,
    hash: storedHash
  };
}

module.exports = generateApiKey;