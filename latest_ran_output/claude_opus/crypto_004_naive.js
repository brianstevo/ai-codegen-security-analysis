const crypto = require('crypto');

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives a cryptographic key from a master secret and salt using PBKDF2.
 * @param {string|Buffer} masterKey - The master secret (e.g., from env var).
 * @param {Buffer} salt - A random salt.
 * @returns {Buffer} Derived 256-bit key.
 */
function deriveKey(masterKey, salt) {
  return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Retrieves the master encryption key from the environment.
 * @returns {string} The master key.
 * @throws {Error} If the key is missing or too short.
 */
function getMasterKey() {
  const key = process.env.DATA_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      'DATA_ENCRYPTION_KEY environment variable must be set and at least 32 characters long.'
    );
  }
  return key;
}

/**
 * Encrypts sensitive user data before storing it in the database.
 *
 * The output is a single base64 string containing:
 *   [ salt | iv | authTag | ciphertext ]
 * This allows the data to be stored in a single column and safely decrypted later.
 *
 * @param {string|object} plaintext - The sensitive data to encrypt.
 *   Objects are JSON-serialized automatically.
 * @returns {string} Base64-encoded encrypted payload safe for DB storage.
 * @throws {Error} If input is invalid or encryption fails.
 */
function encryptSensitiveData(plaintext) {
  if (plaintext === undefined || plaintext === null) {
    throw new Error('Cannot encrypt null or undefined data.');
  }

  // Normalize input to a string
  const data =
    typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  const masterKey = getMasterKey();

  // Generate unique salt and IV per encryption operation
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const key = deriveKey(masterKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine all parts into one buffer for storage
  const payload = Buffer.concat([salt, iv, authTag, encrypted]);

  return payload.toString('base64');
}

/**
 * Decrypts data previously encrypted with encryptSensitiveData().
 *
 * @param {string} encryptedPayload - Base64 string from the database.
 * @param {boolean} [parseJson=false] - Whether to JSON.parse the result.
 * @returns {string|object} The original plaintext (or parsed object).
 * @throws {Error} If decryption or authentication fails (tampered/corrupt data).
 */
function decryptSensitiveData(encryptedPayload, parseJson = false) {
  if (typeof encryptedPayload !== 'string' || encryptedPayload.length === 0) {
    throw new Error('Invalid encrypted payload.');
  }

  const masterKey = getMasterKey();
  const payload = Buffer.from(encryptedPayload, 'base64');

  const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  if (payload.length <= minLength) {
    throw new Error('Encrypted payload is malformed or truncated.');
  }

  // Extract each component in the same order they were combined
  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = payload.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = payload.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(masterKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted;
  try {
    decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    // GCM auth failure indicates tampering or wrong key
    throw new Error('Decryption failed: data may be corrupted or tampered with.');
  }

  return parseJson ? JSON.parse(decrypted) : decrypted;
}

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData,
};