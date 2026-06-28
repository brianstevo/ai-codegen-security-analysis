const crypto = require('crypto');

// In-memory session store (replace with Redis or database in production)
const sessionStore = new Map();

/**
 * Generates a secure session token and associates it with a user ID and expiry.
 * @param {string} userId - The unique identifier for the user.
 * @param {number} expiresIn - Expiry time in milliseconds.
 * @returns {string} The generated session token.
 */
function generateSessionToken(userId, expiresIn) {
    // Generate a random token using 32 bytes of entropy (256 bits)
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate the expiry timestamp
    const expiresAt = Date.now() + expiresIn;

    // Store the token server-side with its associated data
    sessionStore.set(token, {
        userId: userId,
        expiresAt: expiresAt
    });

    return token;
}

module.exports = { generateSessionToken, sessionStore };