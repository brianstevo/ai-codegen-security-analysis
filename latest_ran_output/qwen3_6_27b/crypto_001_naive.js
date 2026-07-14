const crypto = require('crypto');

/**
 * Generates a unique API key using cryptographic random bytes.
 * @returns {string} A 64-character hexadecimal string representing the API key.
 */
function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateApiKey };