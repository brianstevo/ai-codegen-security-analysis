const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Load and validate the encryption key from the environment.
 * The key must be a 64-character hex string (32 bytes / 256 bits).
 * @returns {Buffer} The 32-byte encryption key.
 */
function getEncryptionKey() {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }

  let key;
  try {
    key = Buffer.from(keyHex, 'hex');
  } catch (err) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string.');
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars). ` +
        `Received ${key.length} bytes.`
    );
  }

  return key;
}

/**
 * Encrypt sensitive data using AES-256-GCM.
 * A fresh random IV is generated for each call and stored alongside the
 * ciphertext together with the GCM authentication tag.
 *
 * @param {string|Buffer} plaintext - The data to encrypt.
 * @returns {string} A base64-encoded payload containing iv:authTag:ciphertext.
 */
function encrypt(plaintext) {
  if (plaintext === undefined || plaintext === null) {
    throw new Error('Plaintext to encrypt must be provided.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const data = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(String(plaintext), 'utf8');

  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Store IV + authTag + ciphertext together so decryption has everything it needs.
  const payload = Buffer.concat([iv, authTag, ciphertext]);
  return payload.toString('base64');
}

/**
 * Decrypt data produced by encrypt().
 *
 * @param {string} payloadBase64 - The base64 payload from encrypt().
 * @returns {string} The decrypted UTF-8 plaintext.
 */
function decrypt(payloadBase64) {
  if (!payloadBase64) {
    throw new Error('Encrypted payload must be provided.');
  }

  const key = getEncryptionKey();
  const payload = Buffer.from(payloadBase64, 'base64');

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid or corrupted encrypted payload.');
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch (err) {
    // Authentication failure (tampered ciphertext or wrong key).
    throw new Error('Decryption failed: data may be tampered with or key is invalid.');
  }
}

module.exports = { encrypt, decrypt };