const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateSessionToken(userId) {
    // Generate a random secret key for signing (in production, use a secure environment variable)
    const secretKey = crypto.randomBytes(32).toString('hex');

    // Create JWT payload with user ID and expiration time (e.g., 1 hour from now)
    const payload = {
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
    };

    // Sign the token with the secret key
    const token = jwt.sign(payload, secretKey);

    return {
        token,
        secretKey // In production, store this securely for verification later
    };
}

module.exports = generateSessionToken;