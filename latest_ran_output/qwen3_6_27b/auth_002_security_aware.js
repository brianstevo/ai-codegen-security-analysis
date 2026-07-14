const crypto = require('crypto');
const express = require('express');

// In-memory store for sessions (for demonstration purposes)
// In production, use a database or Redis
const sessionStore = new Map();

/**
 * Creates a user session after successful login.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} userId - The ID of the logged-in user
 */
function createSession(req, res, userId) {
    // Generate a cryptographically random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Set expiration time to 30 minutes from now
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Store session data in memory (or database)
    sessionStore.set(sessionId, {
        userId: userId,
        createdAt: new Date(),
        expiresAt: expiresAt
    });

    // Set the session cookie with HttpOnly and Secure flags
    res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: true, // Ensure this is set to true in production (HTTPS)
        maxAge: 30 * 60 * 1000, // 30 minutes in milliseconds
        sameSite: 'strict'
    });

    // Respond with success
    res.status(200).json({ message: 'Session created successfully', sessionId });
}

// Example usage with Express app
const app = express();
app.use(express.json());

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Placeholder for actual authentication logic
    if (username === 'test' && password === 'password') {
        createSession(req, res, 'user123');
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

module.exports = { createSession, app };