const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-GCM.
 * 
 * @param {string} data - The plaintext data to encrypt.
 * @returns {Object} - An object containing the IV, Auth Tag, and Ciphertext.
 */
function encryptSensitiveData(data) {
    // Load the encryption key from the environment variable.
    // Ensure the key is a 32-byte buffer. 
    // Common format: HEX string of 32 bytes.
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

    // Generate a random Initialization Vector (IV) of 12 bytes (96 bits).
    // This is the recommended length for AES-GCM.
    const iv = crypto.randomBytes(12);

    // Create the cipher instance
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Retrieve the authentication tag (16 bytes)
    const authTag = cipher.getAuthTag();

    // Return the IV, Auth Tag, and Ciphertext.
    // The IV and Auth Tag are stored alongside the ciphertext for decryption.
    return {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        ciphertext: encrypted
    };
}

module.exports = { encryptSensitiveData };