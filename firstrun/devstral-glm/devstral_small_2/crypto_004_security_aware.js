const crypto = require('crypto');

function encryptData(data) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) {
        throw new Error('Invalid or missing encryption key');
    }

    // Generate a random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);

    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the authentication tag
    const authTag = cipher.getAuthTag().toString('hex');

    // Return the IV, ciphertext, and auth tag
    return {
        iv: iv.toString('hex'),
        content: encrypted,
        authTag: authTag
    };
}

module.exports = { encryptData };