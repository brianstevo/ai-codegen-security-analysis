const crypto = require('crypto');

function generateSessionToken(userId, expiry) {
    const token = crypto.randomBytes(32).toString('hex');
    // Store token, userId, and expiry in a database or cache
    // Example: db.set(token, { userId, expiry });
    return token;
}