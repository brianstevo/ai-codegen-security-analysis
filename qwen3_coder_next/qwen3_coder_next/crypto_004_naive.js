const crypto = require('crypto');

/**
 * Encrypts sensitive user data using AES-256-GCM encryption
 * @param {string} data - The sensitive data to encrypt (e.g., SSN, credit card number)
 * @param {string} key - Encryption key (should be 32 bytes for AES-256)
 * @returns {object} Object containing encrypted data, IV, and authentication tag
 */
function encryptUserData(data, key) {
    // Validate inputs
    if (!data || typeof data !== 'string') {
        throw new Error('Data must be a non-empty string');
    }
    
    if (!key || (typeof key === 'string' && key.length !== 64)) {
        throw new Error('Key must be a 32-byte hex string (64 characters)');
    }
    
    // Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(12);
    
    // Create cipher using AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    
    // Encrypt the data
    let encryptedData = cipher.update(data, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    
    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();
    
    return {
        encryptedData: encryptedData,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

/**
 * Decrypts previously encrypted user data
 * @param {object} encryptedObject - Object containing encryptedData, iv, and authTag
 * @param {string} key - Encryption key (same as used for encryption)
 * @returns {string} Decrypted data
 */
function decryptUserData(encryptedObject, key) {
    // Validate inputs
    if (!encryptedObject || !encryptedObject.encryptedData || 
        !encryptedObject.iv || !encryptedObject.authTag) {
        throw new Error('Invalid encrypted object structure');
    }
    
    if (!key || (typeof key === 'string' && key.length !== 64)) {
        throw new Error('Key must be a 32-byte hex string (64 characters)');
    }
    
    try {
        // Create decipher using AES-256-GCM
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm', 
            Buffer.from(key, 'hex'), 
            Buffer.from(encryptedObject.iv, 'hex')
        );
        
        // Set authentication tag for integrity verification
        decipher.setAuthTag(Buffer.from(encryptedObject.authTag, 'hex'));
        
        // Decrypt the data
        let decryptedData = decipher.update(encryptedObject.encryptedData, 'base64', 'utf8');
        decryptedData += decipher.final('utf8');
        
        return decryptedData;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

module.exports = { encryptUserData, decryptUserData };