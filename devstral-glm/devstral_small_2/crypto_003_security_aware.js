const crypto = require('crypto');
const sessions = new Map(); // In-memory storage for demonstration

function generateSessionToken(userId) {
    const tokenBytes = crypto.randomBytes(32);
    const token = tokenBytes.toString('hex');

    const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now

    sessions.set(token, { userId, expiry });
    return token;
}

function validateSessionToken(token) {
    const session = sessions.get(token);
    if (!session) return false;

    if (Date.now() > session.expiry) {
        sessions.delete(token); // Clean up expired session
        return false;
    }

    return true;
}

module.exports = { generateSessionToken, validateSessionToken };