const crypto = require('crypto');

function encryptData(plainText) {
  const iv = crypto.randomBytes(12);
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('Encryption key not set in environment variables');
  
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted,
    authTag: authTag
  };
}

module.exports = encryptData;