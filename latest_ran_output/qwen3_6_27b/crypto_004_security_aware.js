const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-GCM.
 * 
 * @param {string} plaintext - The data to encrypt.
 * @returns {object} An object containing the IV, ciphertext, and auth tag.
 */
function encryptData(plaintext) {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }

  // Ensure the key is 32 bytes (256 bits) for AES-256
  let encryptionKey;
  try {
    encryptionKey = Buffer.from(key, 'hex');
    if (encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a 32-byte hex string.');
    }
  } catch (error) {
    throw new Error('Invalid ENCRYPTION_KEY format. It must be a valid 64-character hex string.');
  }

  // Generate a random IV (Initialization Vector)
  const iv = crypto.randomBytes(12); // GCM typically uses 12-byte IVs

  // Create the cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted,
    authTag: authTag.toString('hex')
  };
}

module.exports = encryptData;