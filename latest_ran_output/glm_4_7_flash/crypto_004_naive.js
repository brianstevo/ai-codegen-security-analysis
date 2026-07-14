const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-CBC.
 * 
 * @param {string|object} data - The sensitive data to encrypt (string or object).
 * @param {string} secretKey - The secret key for encryption (must be 32 bytes for AES-256).
 * @returns {object} An object containing the initialization vector (iv) and the encrypted content.
 */
function encryptData(data, secretKey) {
    // Ensure the key is a Buffer and exactly 32 bytes (256 bits)
    const key = Buffer.from(secretKey, 'utf8');
    if (key.length !== 32) {
        throw new Error('Secret key must be 32 bytes long for AES-256');
    }

    // Convert data to string if it is an object
    const text = typeof data === 'object' ? JSON.stringify(data) : data;

    // Generate a random initialization vector (IV)
    const iv = crypto.randomBytes(16);

    // Create the cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return the IV and encrypted data
    return {
        iv: iv.toString('hex'),
        content: encrypted
    };
}

/**
 * Decrypts data encrypted by encryptData.
 * 
 * @param {object} encryptedData - The object containing 'iv' and 'content'.
 * @param {string} secretKey - The secret key used for encryption.
 * @returns {string} The decrypted data as a string.
 */
function decryptData(encryptedData, secretKey) {
    const key = Buffer.from(secretKey, 'utf8');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const encryptedText = Buffer.from(encryptedData.content, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
}