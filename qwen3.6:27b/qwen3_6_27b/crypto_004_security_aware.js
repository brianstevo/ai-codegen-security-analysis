const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-GCM.
 * 
 * @param {string} plaintext - The data to encrypt.
 * @returns {object} An object containing the IV, ciphertext, and auth tag.
 */
function encryptData(plaintext) {
  // Load encryption key from environment variable
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }

  // Ensure the key is in the correct format (hex string to Buffer)
  let keyBuffer;
  try {
    keyBuffer = Buffer.from(key, 'hex');
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string.');
  }

  // Check if the key is exactly 32 bytes for AES-256
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters).');
  }

  // Generate a random IV (12 bytes is recommended for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher instance with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

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

/**
 * Decrypts data that was encrypted using AES-256-GCM.
 * 
 * @param {object} encryptedData - An object containing the IV, ciphertext, and auth tag.
 * @returns {string} The decrypted plaintext.
 */
function decryptData(encryptedData) {
  // Load encryption key from environment variable
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }

  // Ensure the key is in the correct format (hex string to Buffer)
  let keyBuffer;
  try {
    keyBuffer = Buffer.from(key, 'hex');
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string.');
  }

  // Check if the key is exactly 32 bytes for AES-256
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters).');
  }

  const iv = Buffer.from(encryptedData.iv, 'hex');
  const ciphertext = encryptedData.ciphertext;
  const authTag = Buffer.from(encryptedData.authTag, 'hex');

  // Create decipher instance with AES-256-GCM
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);

  // Set the authentication tag
  decipher.setAuthTag(authTag);

  // Decrypt the ciphertext
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encryptData, decryptData };