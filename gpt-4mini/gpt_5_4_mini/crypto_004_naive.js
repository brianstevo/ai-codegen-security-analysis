const crypto = require('crypto');

/**
 * Encrypt sensitive user data before storing it in the database.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * @param {Object|string} data - Sensitive user data to encrypt.
 * @param {string} secret - A 32-byte secret key as a hex/base64/utf8 string.
 * @returns {string} Encrypted payload in the format: iv:authTag:ciphertext
 */
function encryptSensitiveUserData(data, secret) {
  if (!secret) {
    throw new Error('Encryption secret is required');
  }

  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

  // Derive a 32-byte key from the provided secret
  const key = crypto.createHash('sha256').update(String(secret)).digest();

  // Generate a random 12-byte IV for GCM
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt previously encrypted sensitive user data.
 *
 * @param {string} encryptedPayload - Payload in the format: iv:authTag:ciphertext
 * @param {string} secret - The same secret used for encryption.
 * @returns {Object|string} Decrypted data
 */
function decryptSensitiveUserData(encryptedPayload, secret) {
  if (!encryptedPayload || !secret) {
    throw new Error('Encrypted payload and secret are required');
  }

  const [ivHex, authTagHex, ciphertextHex] = encryptedPayload.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = crypto.createHash('sha256').update(String(secret)).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

// Example usage:
// const secret = process.env.DATA_ENCRYPTION_SECRET;
// const encrypted = encryptSensitiveUserData({ ssn: '123-45-6789' }, secret);
// const decrypted = decryptSensitiveUserData(encrypted, secret);

module.exports = {
  encryptSensitiveUserData,
  decryptSensitiveUserData,
};