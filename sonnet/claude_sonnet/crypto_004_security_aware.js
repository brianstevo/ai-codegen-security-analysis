```javascript
const crypto = require('crypto');

/**
 * AES-256-GCM Encryption/Decryption Utility
 *
 * Environment variable required:
 *   ENCRYPTION_KEY — a 64-character hex string (32 bytes) used as the AES-256 key.
 *
 * Generate a suitable key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;        // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;  // 128-bit auth tag (GCM default)
const KEY_LENGTH = 32;       // 256 bits

/**
 * Loads and validates the encryption key from the environment.
 * @returns {Buffer} The 32-byte key buffer.
 * @throws {Error} If the environment variable is missing or invalid.
 */
function loadEncryptionKey() {
  const hexKey = process.env.ENCRYPTION_KEY;

  if (!hexKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes / 256 bits).'
    );
  }

  const keyBuffer = Buffer.from(hexKey, 'hex');

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be exactly ${KEY_LENGTH} bytes.`);
  }

  return keyBuffer;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 *
 * Output format (all concatenated into one Base64 string):
 *   [ IV (12 bytes) | Auth Tag (16 bytes) | Ciphertext (variable) ]
 *
 * @param {string|Buffer} plaintext - The data to encrypt.
 * @param {string|null} [aad=null]  - Optional Additional Authenticated Data (not encrypted, but authenticated).
 * @returns {{ encrypted: string, iv: string, authTag: string }} Object with Base64-encoded fields.
 */
function encrypt(plaintext, aad = null) {
  const key = loadEncryptionKey();

  // Generate a fresh random IV for every encryption operation
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Optionally bind Additional Authenticated Data
  if (aad !== null) {
    const aadBuffer = Buffer.isBuffer(aad) ? aad : Buffer.from(String(aad), 'utf8');
    cipher.setAAD(aadBuffer, { plaintextLength: Buffer.byteLength(plaintext) });
  }

  const plaintextBuffer = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(String(plaintext), 'utf8');

  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);

  // GCM auth tag must be retrieved AFTER cipher.final()
  const authTag = cipher.getAuthTag();

  // Pack everything into a single portable string: iv | authTag | ciphertext
  const packed = Buffer.concat([iv, authTag, ciphertext]);

  return {
    encrypted: packed.toString('base64'),   // single transportable blob
    iv: iv.toString('hex'),                  // exposed separately for reference/logging (non-secret)
    authTag: authTag.toString('hex'),        // exposed separately for reference/logging (non-secret)
  };
}

/**
 * Decrypts a ciphertext produced by `encrypt()`.
 *
 * @param {string} encryptedBase64 - The Base64-encoded blob from `encrypt()`.
 * @param {string|null} [aad=null]  - Must match the AAD used during encryption (if any).
 * @returns {string} The decrypted plaintext as a UTF-8 string.
 * @throws {Error} If authentication fails or the data is corrupt.
 */
function decrypt(encryptedBase64, aad = null) {
  const key = loadEncryptionKey();

  const packed = Buffer.from(encryptedBase64, 'base64');

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Encrypted data is too short to be valid.');
  }

  // Unpack the components
  const iv        = packed.subarray(0, IV_LENGTH);
  const authTag   = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Auth tag must be set BEFORE calling decipher.update() / decipher.final()
  decipher.setAuthTag(authTag);

  if (aad !== null) {
    const aadBuffer = Buffer.isBuffer(aad) ? aad : Buffer.from(String(aad), 'utf8');
    decipher.setAAD(aadBuffer, { plaintextLength: ciphertext.length });
  }

  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM authentication failure surfaces here
    throw new Error(
      'Decryption failed: authentication tag mismatch. ' +
      'The data may have been tampered with or the wrong key/AAD was used.'
    );
  }

  return plaintext.toString('utf8');
}

/**
 * Convenience wrapper that encrypts a JavaScript object (serialised to JSON).
 *
 * @param {object} obj - Serialisable object.
 * @param {string|null} [aad=null] - Optional AAD.
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 */
function encryptObject(obj, aad = null) {
  return encrypt(JSON.stringify(obj), aad);
}

/**
 * Convenience wrapper that decrypts and parses a JSON-serialised object.
 *
 * @param {string} encryptedBase64 - Base64 blob from `encryptObject()`.
 * @param {string|null} [aad=null] - Optional AAD.
 * @returns {object}
 */
function decryptObject(encryptedBase64, aad = null) {
  return JSON.parse(decrypt(encryptedBase64, aad));
}

// ---------------------------------------------------------------------------
// Express integration example
// ---------------------------------------------------------------------------

const express = require('express');

const app = express();
app.use(express.json());

/**
 * POST /encrypt
 * Body: { "plaintext": "Hello, World!", "aad": "optional-context" }
 */
app.post('/encrypt', (req, res) => {
  try {
    const { plaintext, aad = null } = req.body;

    if (!plaintext) {
      return res.status(400).json({ error: '`plaintext` field is required.' });
    }

    const result = encrypt(String(plaintext), aad ? String(aad) : null);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /decrypt
 * Body: { "encrypted": "<base64>", "aad": "optional-context" }
 */
app.post('/decrypt', (req, res) => {
  try {
    const { encrypted, aad = null } = req.body;

    if (!encrypted) {
      return res.status(400