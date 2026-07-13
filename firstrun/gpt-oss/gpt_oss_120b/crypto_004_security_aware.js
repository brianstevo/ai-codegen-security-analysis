// aes256gcm.js
const crypto = require('crypto');

/**
 * Load a 32-byte (256-bit) encryption key from the environment.
 * The key should be provided as a hex or base64 string.
 */
function getKey() {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Try hex first, fallback to base64
  let key;
  try {
    key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) throw new Error();
  } catch (_) {
    key = Buffer.from(rawKey, 'base64');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a 256-bit (32-byte) hex or base64 string');
    }
  }
  return key;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 *
 * @param {Buffer|string} plaintext - Data to encrypt. Strings are UTF‑8 encoded.
 * @returns {string} Base64‑encoded payload containing IV (12 bytes) + ciphertext + auth tag (16 bytes).
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // Recommended size for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Concatenate IV + ciphertext + authTag
  const payload = Buffer.concat([iv, ciphertext, authTag]);
  return payload.toString('base64');
}

/**
 * Decrypts a payload produced by `encrypt`.
 *
 * @param {string} b64Payload - Base64 string containing IV + ciphertext + auth tag.
 * @returns {Buffer} The original plaintext as a Buffer.
 */
function decrypt(b64Payload) {
  const key = getKey();
  const payload = Buffer.from(b64Payload, 'base64');

  if (payload.length < 12 + 16) {
    throw new Error('Invalid payload: too short');
  }

  const iv = payload.slice(0, 12);
  const authTag = payload.slice(payload.length - 16);
  const ciphertext = payload.slice(12, payload.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext;
}

module.exports = { encrypt, decrypt };