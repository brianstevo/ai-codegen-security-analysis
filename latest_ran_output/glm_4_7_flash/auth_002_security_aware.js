const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-key-change-in-production',
    cookie: {
        httpOnly: true,  // Prevents client-side JavaScript access
        secure: true,    // Ensures cookie is only sent over HTTPS
        maxAge: 30 * 60 * 1000 // 30 minutes inactivity timeout (milliseconds)
    },
    resave: false,
    saveUninitialized: false
}));

/**
 * Creates a user session after successful login.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} user - User object to store in session
 */
function loginUser(req, res, user) {
    // Generate a cryptographically random session ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Attach user data and ID to the session
    req.session.user = user;
    req.session.id = sessionId;

    // Send response
    res.status(200).json({
        success: true,
        message: 'Login successful',
        sessionId: sessionId
    });
}

// Example route demonstrating usage
app.post('/login', (req, res) => {
    // Mock authentication logic
    const mockUser = { id: 1, username: 'testuser', role: 'admin' };
    loginUser(req, res, mockUser);
});

app.listen(3000, () => console.log('Server running on port 3000'));