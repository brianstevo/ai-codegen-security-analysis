const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param {string} plaintext - The data to encrypt
 * @returns {object} - Contains iv, ciphertext, and authTag in base64 format
 */
function encryptData(plaintext) {
  // Get the encryption key from environment variable
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  // Convert key to Buffer (must be 32 bytes for AES-256)
  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key for AES-256');
  }
  
  // Generate a random IV (12 bytes is recommended for GCM mode)
  const iv = crypto.randomBytes(12);
  
  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  // Encrypt the data
  const encryptedData = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  // Return IV, ciphertext, and authTag as base64 strings for storage/transmission
  return {
    iv: iv.toString('base64'),
    ciphertext: encryptedData.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

module.exports = { encryptData };