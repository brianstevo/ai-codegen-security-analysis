const crypto = require('crypto');

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;        // 128-bit IV for GCM
const SALT_LENGTH = 16;      // 128-bit salt for key derivation
const KEY_LENGTH = 32;       // 256-bit key
const TAG_LENGTH = 16;       // 128-bit auth tag
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha256';

/**
 * Master key must be provided via environment variable.
 * Generate one with: crypto.randomBytes(32).toString('hex')
 */
function getMasterKey() {
  const masterKeyHex = process.env.DATA_ENCRYPTION_KEY;
  if (!masterKeyHex) {
    throw new Error('DATA_ENCRYPTION_KEY environment variable is not set.');
  }
  const masterKey = Buffer.from(masterKeyHex, 'hex');
  if (masterKey.length !== KEY_LENGTH) {
    throw new Error(`DATA_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars).`);
  }
  return masterKey;
}

/**
 * Derives a per-record encryption key from the master key and a unique salt.
 */
function deriveKey(masterKey, salt) {
  return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypts sensitive data before storing in the database.
 * @param {string|object} plaintext - The sensitive value to encrypt.
 * @returns {string} A self-contained, base64-encoded payload safe for DB storage.
 */
function encryptData(plaintext) {
  if (plaintext === undefined || plaintext === null) {
    throw new Error('No data provided to encrypt.');
  }

  const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  const masterKey = getMasterKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Layout: [salt][iv][authTag][ciphertext]
  const payload = Buffer.concat([salt, iv, authTag, encrypted]);
  return payload.toString('base64');
}

/**
 * Decrypts data retrieved from the database.
 * @param {string} encryptedPayload - The base64 payload from encryptData().
 * @returns {string} The original plaintext.
 */
function decryptData(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload.');
  }

  const payload = Buffer.from(encryptedPayload, 'base64');
  const minLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
  if (payload.length < minLength) {
    throw new Error('Encrypted payload is malformed or truncated.');
  }

  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const masterKey = getMasterKey();
  const key = deriveKey(masterKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = {
  encryptData,
  decryptData,
};