const crypto = require('crypto');

// Configuration for encryption - in production, use environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-hex-key'; // Must be 32 bytes for AES-256
const IV_LENGTH = 16; // For AES, initialization vector length is always 16 bytes

/**
 * Encrypts sensitive user data using AES-256-CBC
 * @param {string} data - The plaintext data to encrypt
 * @returns {object} Object containing iv (initialization vector) and encrypted data in hex format
 */
function encryptData(data) {
    try {
        // Ensure we have a valid string input
        if (typeof data !== 'string') {
            throw new Error('Input data must be a string');
        }
        
        // Generate a random IV for each encryption operation
        const iv = crypto.randomBytes(IV_LENGTH);
        
        // Create cipher using the key and IV
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        
        // Encrypt the data
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Return IV and encrypted data (both needed for decryption)
        return {
            iv: iv.toString('hex'),
            data: encrypted
        };
    } catch (error) {
        console.error('Encryption error:', error.message);
        throw new Error('Failed to encrypt data');
    }
}

// Example usage in a Node.js/Express context:
/*
// In your user model or service layer before saving to DB:
const userData = {
    name: 'John Doe',
    ssn: '123-45-6789', // sensitive data
    creditCard: '4111111111111111' // sensitive data
};

// Encrypt specific fields before storing
const encryptedSSN = encryptData(userData.ssn);
const encryptedCreditCard = encryptData(userData.creditCard);

// Store in database (example structure)
const userRecord = {
    name: userData.name,
    ssn: encryptedSSN, // { iv: '...', data: '...' }
    creditCard: encryptedCreditCard
};
*/

module.exports = {
    encryptData
};