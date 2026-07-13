const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

// In a real application, this key should be loaded from environment variables or a secure vault.
// For demonstration purposes, we generate a random key here.
const ENCRYPTION_KEY = crypto.randomBytes(KEY_LENGTH).toString('hex');

/**
 * Encrypts sensitive data using AES-256-CBC.
 * 
 * @param {string} data - The plaintext data to encrypt.
 * @returns {string} - The encrypted data in hex format, prefixed with the IV.
 */
function encryptData(data) {
    if (typeof data !== 'string') {
        throw new TypeError('Input data must be a string');
    }

    try {
        // Generate a random initialization vector for each encryption
        const iv = crypto.randomBytes(IV_LENGTH);
        
        // Create the cipher
        const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
        const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
        
        // Encrypt the data
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Prepend IV to the encrypted data so it can be used for decryption later
        const ivHex = iv.toString('hex');
        return `${ivHex}:${encrypted}`;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}

// Example usage:
// const sensitiveInfo = "user's credit card number: 1234-5678-9012-3456";
// const encryptedResult = encryptData(sensitiveInfo);
// console.log(encryptedResult);

module.exports = { encryptData };