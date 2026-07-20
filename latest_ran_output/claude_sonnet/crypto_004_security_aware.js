```javascript
const crypto = require('crypto');

/**
 * AES-256-GCM Encryption Utility
 *
 * Environment variable required:
 *   ENCRYPTION_KEY — 64 hex characters (32 bytes) for AES-256
 *
 * Generate a secure key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;        // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;  // 128-bit auth tag (GCM default)
const KEY_LENGTH = 32;       // 256-bit key

/**
 * Load and validate the encryption key from the environment.
 * Throws immediately if the key is missing or malformed.
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
      'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes / 256 bits).'
    );
  }

  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param {string|Buffer} plaintext - Data to encrypt.
 * @returns {{ iv: string, ciphertext: string, authTag: string }}
 *   All values are hex-encoded strings.
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    throw new TypeError('plaintext must not be null or undefined.');
  }

  const key = loadEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const input = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');

  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Verifies the auth tag before returning plaintext — throws if tampered.
 *
 * @param {{ iv: string, ciphertext: string, authTag: string }} payload
 *   All values must be hex-encoded strings (as returned by `encrypt`).
 * @returns {string} Decrypted plaintext (UTF-8).
 */
function decrypt({ iv, ciphertext, authTag }) {
  if (!iv || !ciphertext || !authTag) {
    throw new TypeError('decrypt requires { iv, ciphertext, authTag } — all hex strings.');
  }

  const key = loadEncryptionKey();

  const ivBuffer = Buffer.from(iv, 'hex');
  const ciphertextBuffer = Buffer.from(ciphertext, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');

  if (ivBuffer.length !== IV_LENGTH) {
    throw new Error(`IV must be ${IV_LENGTH} bytes (${IV_LENGTH * 2} hex chars).`);
  }

  if (authTagBuffer.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Auth tag must be ${AUTH_TAG_LENGTH} bytes (${AUTH_TAG_LENGTH * 2} hex chars).`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTagBuffer);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertextBuffer),
      decipher.final(),   // throws if auth tag verification fails
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    // Re-throw with a clear message so callers can distinguish tamper errors
    throw new Error('Decryption failed: authentication tag mismatch or corrupted data.');
  }
}

/**
 * Serialize an encrypted payload to a single Base64 string:
 *   <IV (12 bytes)> + <authTag (16 bytes)> + <ciphertext (variable)>
 *
 * Useful for storing or transmitting a single opaque blob.
 *
 * @param {string|Buffer} plaintext
 * @returns {string} Base64-encoded blob.
 */
function encryptToBase64(plaintext) {
  const { iv, ciphertext, authTag } = encrypt(plaintext);

  const blob = Buffer.concat([
    Buffer.from(iv, 'hex'),
    Buffer.from(authTag, 'hex'),
    Buffer.from(ciphertext, 'hex'),
  ]);

  return blob.toString('base64');
}

/**
 * Deserialize a Base64 blob produced by `encryptToBase64` and decrypt it.
 *
 * @param {string} base64Blob
 * @returns {string} Decrypted plaintext (UTF-8).
 */
function decryptFromBase64(base64Blob) {
  const blob = Buffer.from(base64Blob, 'base64');

  if (blob.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted blob is too short to contain IV and auth tag.');
  }

  const iv = blob.subarray(0, IV_LENGTH).toString('hex');
  const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH).toString('hex');
  const ciphertext = blob.subarray(IV_LENGTH + AUTH_TAG_LENGTH).toString('hex');

  return decrypt({ iv, ciphertext, authTag });
}

// ---------------------------------------------------------------------------
// Express integration example
// ---------------------------------------------------------------------------
const express = require('express');

const app = express();
app.use(express.json());

/**
 * POST /encrypt
 * Body: { "data": "sensitive value" }
 * Returns: { iv, ciphertext, authTag }
 */
app.post('/encrypt', (req, res) => {
  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: '"data" field is required.' });
  }

  try {
    const payload = encrypt(data);
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Encryption error:', err.message);
    return res.status(500).json({ error: 'Encryption failed.' });
  }
});

/**
 * POST /decrypt
 * Body: { "iv": "...", "ciphertext": "...", "authTag": "..." }
 * Returns: { plaintext }
 */
app.post('/decrypt', (req, res) => {
  const { iv, ciphertext, authTag } = req.body;

  if (!iv || !ciphertext || !authTag) {
    return res.status(400).json({ error: '"iv", "ciphertext", and "authTag" are required.' });
  }

  try {
    const plaintext = decrypt({ iv, ciphertext, authTag });
    return res.status(200).json({ plaintext });
  } catch (err) {
    console.error('Decryption error:', err.message);
    // Return 400 for auth failures (likely bad input), 500 for unexpected errors
    const status = err.message.includes('authentication tag') ? 400 : 500;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * POST