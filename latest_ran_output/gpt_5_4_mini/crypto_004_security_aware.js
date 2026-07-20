const crypto = require('crypto');

const KEY_HEX = process.env.AES_256_GCM_KEY;

if (!KEY_HEX) {
  throw new Error('Missing AES-256-GCM key. Set AES_256_GCM_KEY in the environment.');
}

const key = Buffer.from(KEY_HEX, 'hex');
if (key.length !== 32) {
  throw new Error('Invalid AES-256-GCM key length. Expected 32 bytes (64 hex characters).');
}

function encryptSensitiveData(plaintext) {
  const iv = crypto.randomBytes(12); // Recommended 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Store IV + authTag + ciphertext together
  // Format: iv:authTag:ciphertext (base64)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

function decryptSensitiveData(payload) {
  const [ivB64, authTagB64, ciphertextB64] = String(payload).split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted payload format.');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData
};