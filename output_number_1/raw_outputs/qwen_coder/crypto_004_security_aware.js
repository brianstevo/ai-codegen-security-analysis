const crypto = require('crypto');

function encryptData(plainText) {
  const iv = crypto.randomBytes(12);
  const key = process.env.ENCRYPTION_KEY; // Load encryption key from environment variable

  if (!key) {
    throw new Error('Encryption key is not set');
  }

  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted,
    authTag: authTag.toString('hex')
  };
}

module.exports = encryptData;