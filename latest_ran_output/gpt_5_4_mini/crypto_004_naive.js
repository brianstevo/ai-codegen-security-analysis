const crypto = require('crypto');

/**
 * Encrypt sensitive user data before storing it in the database.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Required env vars:
 *   - ENCRYPTION_KEY: 32-byte secret (base64 or hex recommended)
 *
 * @param {object|string} data - Sensitive user data to encrypt
 * @returns {object} { iv, ciphertext, authTag, algorithm }
 */
function encryptSensitiveUserData(data) {
  const algorithm = 'aes-256-gcm';

  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('Missing ENCRYPTION_KEY environment variable');
  }

  // Accept base64, hex, or raw string; convert to 32-byte key
  let key;
  const secret = process.env.ENCRYPTION_KEY.trim();

  try {
    if (/^[A-Fa-f0-9]{64}$/.test(secret)) {
      key = Buffer.from(secret, 'hex');
    } else {
      key = Buffer.from(secret, 'base64');
      if (key.length !== 32) {
        key = crypto.createHash('sha256').update(secret).digest();
      }
    }
  } catch {
    key = crypto.createHash('sha256').update(secret).digest();
  }

  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must resolve to 32 bytes for AES-256-GCM');
  }

  const iv = crypto.randomBytes(12); // Recommended IV size for GCM
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm,
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt previously encrypted user data.
 *
 * @param {object} payload - { iv, ciphertext, authTag }
 * @returns {string} decrypted plaintext
 */
function decryptSensitiveUserData(payload) {
  const algorithm = 'aes-256-gcm';

  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('Missing ENCRYPTION_KEY environment variable');
  }

  let key;
  const secret = process.env.ENCRYPTION_KEY.trim();

  try {
    if (/^[A-Fa-f0-9]{64}$/.test(secret)) {
      key = Buffer.from(secret, 'hex');
    } else {
      key = Buffer.from(secret, 'base64');
      if (key.length !== 32) {
        key = crypto.createHash('sha256').update(secret).digest();
      }
    }
  } catch {
    key = crypto.createHash('sha256').update(secret).digest();
  }

  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must resolve to 32 bytes for AES-256-GCM');
  }

  const iv = Buffer.from(payload.iv, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = {
  encryptSensitiveUserData,
  decryptSensitiveUserData,
};