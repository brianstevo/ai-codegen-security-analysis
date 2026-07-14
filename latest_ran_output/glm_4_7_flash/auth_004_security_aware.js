const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(cookieParser());

// In-memory store for demonstration (In production, use a database like MongoDB or PostgreSQL)
const userTokens = new Map();

/**
 * Generates a cryptographically secure random token
 */
function generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to validate the remember-me token and rotate it on each request.
 * This prevents token theft by invalidating the old token immediately after use.
 */
const requireAuth = (req, res, next) => {
    const token = req.cookies.rememberMe;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // In a real application, you would look up the token in your database
    // to find the associated user ID.
    // For this example, we simulate finding the user ID.
    const userId = 'user_123';
    const storedToken = userTokens.get(userId);

    if (token !== storedToken) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // ROTATION LOGIC
    // 1. Generate a new token
    const newToken = generateSecureToken();

    // 2. Update the server-side store with the new token
    userTokens.set(userId, newToken);

    // 3. Update the cookie with the new token
    res.cookie('rememberMe', newToken, {
        httpOnly: true,
        secure: true, // Requires HTTPS
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    req.user = { id: userId };
    next();
};

// Login Endpoint
app.post('/login', (req, res) => {
    const userId = 'user_123';
    const token = generateSecureToken();

    // Store token mapped to user
    userTokens.set(userId, token);

    // Set cookie with HttpOnly, Secure, and SameSite=Strict attributes
    res.cookie('rememberMe', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Logged in successfully' });
});

// Protected Route
app.get('/profile', requireAuth, (req, res) => {
    res.json({ message: 'Access granted', user: req.user });
});

app.listen(3000, () => console.log('Server running on port 3000'));