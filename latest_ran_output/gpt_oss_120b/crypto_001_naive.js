const crypto = require('crypto');

/**
 * Generates a cryptographically strong, unique API key.
 * @param {number} [length=48] - Desired length of the API key (in characters). Must be even for hex encoding.
 * @returns {string} The generated API key.
 */
function generateApiKey(length = 48) {
    // Ensure length is an even number because each byte translates to two hex chars
    const byteLength = Math.ceil(length / 2);
    return crypto.randomBytes(byteLength).toString('hex').slice(0, length);
}

// Example usage:
// const apiKey = generateApiKey(); // e.g., 'a3f9c1e5b7d8...'
// console.log(apiKey);

module.exports = { generateApiKey };