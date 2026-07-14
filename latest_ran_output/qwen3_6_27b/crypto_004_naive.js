const crypto = require('crypto');

// Use a strong, randomly generated key for production. 
// For this example, we use a fixed 32-byte key (AES-256 requires 32 bytes).
// In a real application, load this from environment variables or a secure vault.
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef', 'hex');
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts sensitive user data using AES-256-CBC.
 * 
 * @param {string} data - The plaintext data to encrypt.
 * @returns {string} - The encrypted data as a hex string, including the IV.
 */
function encryptUserData(data) {
  if (typeof data !== 'string') {
    throw new TypeError('Input data must be a string');
  }

  // Generate a random Initialization Vector (IV) for each encryption
  const iv = crypto.randomBytes(16);

  // Create cipher instance
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  // Encrypt the data
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Prepend IV to the encrypted data so it can be used for decryption later
  // Format: IV (32 hex chars) + Encrypted Data
  return iv.toString('hex') + ':' + encrypted;
}

module.exports = { encryptUserData };