```javascript
'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key

/**
 * Loads and validates the AES-256 key from an environment variable.
 * The env var must contain a 64-character hex string (32 bytes).
 *
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} if the key is missing or invalid
 */
function loadEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
        'Provide a 64-character hex string (32 bytes).'
    );
  }

  let key;
  try {
    key = Buffer.from(rawKey, 'hex');
  } catch (err) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string.');
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes ` +
        `(got ${key.length} bytes). Use a 64-character hex string.`
    );
  }

  return key;
}

/**
 * Encrypts sensitive data using AES-256-GCM.
 * A fresh random IV is generated for every call. The returned payload
 * bundles the IV, auth tag, and ciphertext so it can be safely stored
 * and later decrypted.
 *
 * @param {string|Buffer} plaintext - The data to encrypt.
 * @param {object} [options]
 * @param {string} [options.encoding='base64'] - Output encoding for the combined payload.
 * @returns {{ iv: string, authTag: string, ciphertext: string, payload: string }}
 */
function encrypt(plaintext, options = {}) {
  const { encoding = 'base64' } = options;

  if (plaintext === undefined || plaintext === null) {
    throw new Error('Plaintext to encrypt must be provided.');
  }

  const key = loadEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const data = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(String(plaintext), 'utf8');

  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combined payload layout: [IV][AUTH_TAG][CIPHERTEXT]
  const payload = Buffer.concat([iv, authTag, ciphertext]);

  return {
    iv: iv.toString(encoding),
    authTag: authTag.toString(encoding),
    ciphertext: ciphertext.toString(encoding),
    payload: payload.toString(encoding),
  };
}

/**
 * Decrypts a payload produced by encrypt().
 * Accepts either the combined payload string or the discrete parts.
 *
 * @param {string|object} input - The combined payload string, or an
 *   object with { iv, authTag, ciphertext }.
 * @param {object} [options]
 * @param {string} [options.encoding='base64'] - Encoding of the input fields.
 * @param {string} [options.outputEncoding='utf8'] - Encoding of the returned plaintext.
 * @returns {string} The decrypted plaintext.
 */
function decrypt(input, options = {}) {
  const { encoding = 'base64', outputEncoding = 'utf8' } = options;
  const key = loadEncryptionKey();

  let iv;
  let authTag;
  let ciphertext;

  if (typeof input === 'string') {
    const payload = Buffer.from(input, encoding);

    if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid payload: too short to contain IV and auth tag.');
    }

    iv = payload.subarray(0, IV_LENGTH);
    authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  } else if (input && typeof input === 'object') {
    iv = Buffer.from(input.iv, encoding);
    authTag = Buffer.from(input.authTag, encoding);
    ciphertext = Buffer.from(input.ciphertext, encoding);
  } else {
    throw new Error('Invalid input: expected a payload string or object.');
  }

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length.');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted;
  try {
    decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  } catch (err) {
    // GCM auth tag verification failure throws here.
    throw new Error('Decryption failed: data may be tampered or key is wrong.');
  }

  return decrypted.toString(outputEncoding);
}

/**
 * Utility to generate a fresh 256-bit