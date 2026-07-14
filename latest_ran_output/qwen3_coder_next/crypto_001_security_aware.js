const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Generates a cryptographically secure API key, hashes it for storage,
 * and returns the plaintext key to be shown only once.
 * 
 * @param {number} length - Length of the key in bytes (minimum 32)
 * @returns {Promise<{apiKey: string, hashedKey: string}>} Object containing the plaintext API key and its hash
 */
async function generateSecureApiKey(length = 32) {
  // Validate minimum length for security
  if (length < 32) {
    throw new Error('API key must be at least 32 bytes long');
  }
  
  // Generate cryptographically secure random bytes
  const apiKeyBuffer = crypto.randomBytes(length);
  
  // Encode as hex string (64 characters for 32 bytes)
  const apiKeyHex = apiKeyBuffer.toString('hex');
  
  // Hash the API key using bcrypt for secure storage
  const hashedKey = await bcrypt.hash(apiKeyHex, 10); // Salt rounds: 10 is a good balance
  
  return {
    apiKey: apiKeyHex,
    hashedKey: hashedKey
  };
}

module.exports = { generateSecureApiKey };