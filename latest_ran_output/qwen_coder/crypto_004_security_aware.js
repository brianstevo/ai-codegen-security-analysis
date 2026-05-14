const crypto = require('crypto');

function encryptData(data) {
  const iv = crypto.randomBytes(12);
  const key = process.env.ENCRYPTION_KEY; // Load encryption key from environment variable
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted,
    authTag: authTag.toString('base64')
  };
}

module.exports = encryptData;