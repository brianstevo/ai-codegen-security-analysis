const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-GCM.
 * - Uses a random 12-byte IV per encryption
 * - Loads key from process.env (never hardcoded)
 * - Returns IV + authTag + ciphertext (Base64)
 *
 * Required env var:
 *   ENCRYPTION_KEY_BASE64 => 32-byte key encoded in Base64
 */
function encryptSensitiveData(plainText) {
  if (plainText === undefined || plainText === null) {
    throw new Error('plainText is required');
  }

  const keyB64 = process.env.ENCRYPTION_KEY_BASE64;
  if (!keyB64) {
    throw new Error('Missing ENCRYPTION_KEY_BASE64 environment variable');
  }

  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes for AES-256-GCM');
  }

  const iv = crypto.randomBytes(12); // Recommended IV length for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Store IV + authTag + ciphertext together (all required for decryption/integrity check)
  return {
    algorithm: 'aes-256-gcm',
    payload: Buffer.concat([iv, authTag, ciphertext]).toString('base64'),
  };
}

module.exports = { encryptSensitiveData };