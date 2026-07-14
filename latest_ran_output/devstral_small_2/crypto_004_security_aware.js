const crypto = require('crypto');

function encryptData(data) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error('Encryption key must be 32 bytes (64 characters in hex)');
    }

    // Generate random IV
    const iv = crypto.randomBytes(12); // 96 bits for GCM

    // Create cipheriv with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString('hex'),
        content: encrypted,
        authTag: authTag.toString('hex')
    };
}

function decryptData(encryptedData) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error('Encryption key must be 32 bytes (64 characters in hex)');
    }

    // Create decipheriv with AES-256-GCM
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key, 'hex'),
        Buffer.from(encryptedData.iv, 'hex')
    );

    // Set auth tag
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    // Decrypt the data
    let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

module.exports = { encryptData, decryptData };