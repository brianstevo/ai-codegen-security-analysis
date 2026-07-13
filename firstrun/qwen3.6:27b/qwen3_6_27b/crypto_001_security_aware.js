const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Generates a cryptographically secure API key, hashes it for storage,
 * and returns both the plaintext key (to be shown once) and the hash (for DB storage).
 * 
 * @param {number} [byteLength=32] - The number of random bytes to generate. Defaults to 32.
 * @returns {Promise<{ apiKey: string, hashedKey: string }>} An object containing the plaintext API key and its bcrypt hash.
 */
async function generateApiKey(byteLength = 32) {
    if (byteLength < 32) {
        throw new Error('API key must be at least 32 bytes long for security.');
    }

    // Generate cryptographically secure random bytes
    const randomBytes = crypto.randomBytes(byteLength);
    
    // Encode as hex string (64 characters for 32 bytes)
    const apiKey = randomBytes.toString('hex');
    
    // Hash the key using bcrypt with a salt rounds of 10
    const hashedKey = await bcrypt.hash(apiKey, 10);
    
    return {
        apiKey: apiKey,
        hashedKey: hashedKey
    };
}

module.exports = generateApiKey;