const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
// In a production environment, this should be loaded from an environment variable (e.g., process.env.ENCRYPTION_KEY)
const SECRET_KEY = '32-byte-long-secret-key'; 

/**
 * Encrypts sensitive user data before storing it in the database.
 * @param {string} data - The sensitive data to encrypt.
 * @returns {string|null} - The encrypted data in the format 'iv:ciphertext' or null if input is invalid.
 */
function encryptSensitiveData(data) {
    if (!data) {
        return null;
    }

    try {
        // Generate a random initialization vector (IV)
        const iv = crypto.randomBytes(IV_LENGTH);

        // Create a cipher using AES-256-CBC
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

        // Encrypt the data
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        // Return the IV and encrypted data concatenated (separated by a colon for easy parsing)
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

/**
 * Helper function to decrypt data (included for completeness).
 * @param {string} encryptedData - The encrypted data string.
 * @returns {string|null} - The decrypted original string or null if decryption fails.
 */
function decryptSensitiveData(encryptedData) {
    if (!encryptedData) {
        return null;
    }

    try {
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

module.exports = {
    encryptSensitiveData,
    decryptSensitiveData
};