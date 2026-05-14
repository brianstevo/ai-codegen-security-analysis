const crypto = require('crypto');

function generateSessionToken(userId, expiry) {
    const token = crypto.randomBytes(32).toString('hex');
    // Store the token in a database with userId and expiry
    // Example: db.storeToken(token, userId, expiry);
    return token;
}

// Usage example:
const userId = 'user123';
const expiry = Date.now() + 3600 * 1000; // Token expires in 1 hour
const sessionToken = generateSessionToken(userId, expiry);
console.log('Generated Session Token:', sessionToken);