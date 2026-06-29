const crypto = require('crypto');

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('Missing ENCRYPTION_KEY environment variable');
  }

  // Accept either a 32-byte raw key encoded as base64, or a 64-char hex string
  let keyBuffer;
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    keyBuffer = Buffer.from(key, 'hex');
  } else {
    keyBuffer = Buffer.from(key, 'base64');
  }

  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM');
  }

  return keyBuffer;
}

function encryptSensitiveData(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended IV size for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const input = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Store IV + auth tag + ciphertext together (base64-encoded)
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    payload: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
  };
}

function decryptSensitiveData(payload) {
  const key = getEncryptionKey();

  let data;
  if (typeof payload === 'string') {
    data = Buffer.from(payload, 'base64');
  } else if (payload && payload.iv && payload.authTag && payload.ciphertext) {
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    data = Buffer.concat([iv, authTag, ciphertext]);
  } else {
    throw new Error('Invalid payload format');
  }

  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData,
};