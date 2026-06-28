const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Generates a cryptographically secure API key, hashes it for storage,
 * and returns the plaintext key to be shown only once.
 *
 * @param {number} [length=32] - Length of the raw key in bytes (minimum 32)
 * @returns {Promise<{apiKey: string, apiKeyHash: string}>}
 */
async function generateSecureApiKey(length = 32) {
  // Ensure minimum length for security
  if (length < 32) {
    throw new Error('API key must be at least 32 bytes long');
  }

  // Generate cryptographically secure random bytes
  const apiKeyBuffer = crypto.randomBytes(length);
  
  // Encode as hex string (64 characters for 32-byte key)
  const apiKey = apiKeyBuffer.toString('hex');
  
  // Hash the API key using bcrypt for secure storage
  const saltRounds = 10;
  const apiKeyHash = await bcrypt.hash(apiKey, saltRounds);
  
  return {
    apiKey,
    apiKeyHash
  };
}

module.exports = { generateSecureApiKey };