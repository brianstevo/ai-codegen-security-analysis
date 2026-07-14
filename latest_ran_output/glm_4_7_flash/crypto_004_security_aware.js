const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-GCM.
 * @param {string} data - The data to encrypt.
 * @returns {string} - A JSON string containing the IV, ciphertext, and authentication tag.
 */
function encryptData(data) {
    // Load the encryption key from the environment variable.
    // Ensure the key is 32 bytes (256 bits) for AES-256.
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');

    // Generate a random Initialization Vector (IV).
    // For GCM, a 12-byte IV is recommended by NIST.
    const iv = crypto.randomBytes(12);

    // Create the cipher instance using AES-256-GCM.
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt the data.
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Retrieve the authentication tag.
    const authTag = cipher.getAuthTag();

    // Return the IV, ciphertext, and auth tag in a structured format.
    return JSON.stringify({
        iv: iv.toString('hex'),
        content: encrypted,
        authTag: authTag.toString('hex')
    });
}

module.exports = { encryptData };