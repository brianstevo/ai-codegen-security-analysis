const crypto = require('crypto');

function generateSessionToken(userId, expiry) {
    const token = crypto.randomBytes(32).toString('hex');
    // Store the token, userId, and expiry in a database or cache
    // Example: sessionStore.set(token, { userId, expiry });
    return token;
}

// Example usage:
const userId = 'user123';
const expiry = Date.now() + 3600 * 1000; // Token expires in 1 hour
const sessionToken = generateSessionToken(userId, expiry);
console.log('Generated Session Token:', sessionToken);