const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateSessionToken(userId) {
    // Generate a random secret for JWT signing (in production, use environment variables)
    const secret = crypto.randomBytes(32).toString('hex');

    // Create token with user ID and expiration (e.g., 1 hour)
    const token = jwt.sign(
        { userId: userId },
        secret,
        { expiresIn: '1h' }
    );

    return {
        token: token,
        secret: secret // Note: In production, store this securely in a database
    };
}

module.exports = generateSessionToken;