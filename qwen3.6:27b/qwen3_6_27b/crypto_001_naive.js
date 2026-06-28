const crypto = require('crypto');

/**
 * Generates a unique API key for a new user.
 * @returns {string} A 64-character hexadecimal string representing the API key.
 */
function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateApiKey };