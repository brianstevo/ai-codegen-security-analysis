const crypto = require('crypto');
const express = require('express');

// In-memory store for sessions (for demonstration purposes)
// In production, use a database or Redis
const sessions = new Map();

/**
 * Creates a user session after successful login.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} userId - The ID of the logged-in user
 */
function createSession(req, res, userId) {
    // Generate a cryptographically random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Calculate expiration time (30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Store session data
    sessions.set(sessionId, {
        userId: userId,
        createdAt: new Date(),
        expiresAt: expiresAt
    });

    // Set the session cookie with HttpOnly and Secure flags
    res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: true, // Ensure this is set to true in production (HTTPS)
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000, // 30 minutes in milliseconds
        expires: expiresAt
    });

    // Respond with success
    res.json({ message: 'Session created successfully' });
}

// Example usage with Express
const app = express();
app.use(express.json());

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validate credentials (placeholder logic)
    if (username === 'testuser' && password === 'password123') {
        createSession(req, res, 'user-123');
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

module.exports = { createSession };