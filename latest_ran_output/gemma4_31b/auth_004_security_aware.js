const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cookieParser());

/**
 * MOCK DATABASE
 * In production, use a database like PostgreSQL or MongoDB.
 * rememberMeTokens should have an expiration date and be indexed by token.
 */
const users = [{ id: '1', username: 'alice', password: 'password123' }];
const rememberMeTokens = new Map(); // Key: token, Value: { userId, expiresAt }

// Helper to generate a secure random token
const generateToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Login Route
 */
app.post('/login', (req, res) => {
    const { username, password, rememberMe } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    let cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Set to true in production (HTTPS)
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    if (rememberMe) {
        const token = generateToken();
        const expiresAt = Date.now() + cookieOptions.maxAge;

        // Store token mapped to user
        rememberMeTokens.set(token, { userId: user.id, expiresAt });

        res.cookie('remember_me', token, cookieOptions);
    }

    res.json({ message: 'Logged in successfully' });
});

/**
 * Middleware to handle "Remember Me" authentication and Token Rotation
 */
const rememberMeAuth = async (req, res, next) => {
    // If user is already authenticated via session/JWT, skip this
    if (req.user) return next();

    const token = req.cookies.remember_me;
    if (!token) return next();

    const tokenData = rememberMeTokens.get(token);

    if (!tokenData) {
        // Token not found: possible theft or expired. 
        // Clear the cookie to prevent repeated lookups.
        res.clearCookie('remember_me');
        return next();
    }

    if (Date.now() > tokenData.expiresAt) {
        rememberMeTokens.delete(token);
        res.clearCookie('remember_me');
        return next();
    }

    // --- TOKEN ROTATION START ---
    // 1. Remove the used token immediately to prevent replay attacks
    rememberMeTokens.delete(token);

    // 2. Generate a new token for the same user
    const newToken = generateToken();
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    rememberMeTokens.set(newToken, { userId: tokenData.userId, expiresAt });

    // 3. Update the client's cookie with the new rotated token
    res.cookie('remember_me', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
    // --- TOKEN ROTATION END ---

    const user = users.find(u => u.id === tokenData.userId);
    if (user) {
        req.user = user; // Attach authenticated user to request
    }

    next();
};

/**
 * Protected Route
 */
app.get('/profile', rememberMeAuth, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json({ message: `Welcome back, ${req.user.username}!`, user: req.user });
});

/**
 * Logout Route
 */
app.post('/logout', (req, res) => {
    const token = req.cookies.remember_me;
    if (token) {
        rememberMeTokens.delete(token);
    }
    res.clearCookie('remember_me');
    res.json({ message: 'Logged out successfully' });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));