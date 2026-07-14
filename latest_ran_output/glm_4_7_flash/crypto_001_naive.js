const crypto = require('crypto');

/**
 * Generates a unique API key for a new user.
 * Format: 'usr_' + timestamp + random_string
 * @returns {string} The generated API key.
 */
function generateApiKey() {
    // Generate a random string of 32 bytes
    const randomBytes = crypto.randomBytes(32);
    // Convert to base64 and remove padding characters
    const randomString = randomBytes.toString('base64').replace(/=/g, '');
    // Combine prefix, timestamp, and random string to ensure uniqueness
    return `usr_${Date.now()}_${randomString}`;
}

module.exports = generateApiKey;