// aes256gcm.js
const crypto = require('crypto');

/**
 * Retrieves the AES-256-GCM key from the environment.
 * The key must be a base64‑encoded 32‑byte (256‑bit) string.
 */
function getKey() {
  const keyB64 = process.env.ENCRYPTION_KEY;
  if (!keyB64) throw new Error('ENCRYPTION_KEY env variable is not set');
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be a 256‑bit (32‑byte) base64 string');
  return key;
}

/**
 * Encrypts `plainText` using AES‑256‑GCM.
 * Returns a Base64 string containing: IV || AuthTag || Ciphertext
 *
 * @param {string|Buffer} plainText - Data to encrypt.
 * @returns {string} Base64‑encoded encrypted payload.
 */
function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96‑bit IV is recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plainText, typeof plainText === 'string' ? 'utf8' : undefined),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Concatenate IV + AuthTag + Ciphertext and encode as Base64
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Decrypts a payload produced by `encrypt`.
 *
 * @param {string} encryptedB64 - Base64 string containing IV || AuthTag || Ciphertext.
 * @returns {string} The original plaintext.
 */
function decrypt(encryptedB64) {
  const key = getKey();
  const data = Buffer.from(encryptedB64, 'base64');

  // Extract components
  const iv = data.slice(0, 12);               // first 12 bytes
  const authTag = data.slice(12, 28);         // next 16 bytes
  const ciphertext = data.slice(28);          // remainder

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };