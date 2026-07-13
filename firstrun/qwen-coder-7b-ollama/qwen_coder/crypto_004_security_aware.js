const crypto = require('crypto');

function encryptData(data) {
  const iv = crypto.randomBytes(12);
  const key = process.env.ENCRYPTION_KEY;
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted,
    authTag: authTag.toString('hex')
  };
}

module.exports = encryptData;