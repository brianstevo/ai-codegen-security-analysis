const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// In-memory storage for tokens (In production, use a database like Redis or MongoDB)
const tokenStore = new Map();

/**
 * Generates a cryptographically secure random token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Sets the 'remember_me' cookie with HttpOnly, Secure, and SameSite=Strict attributes.
 * Also stores the token server-side.
 */
function setRememberMeCookie(res, userId) {
    const token = generateToken();
    // Store token mapping: token -> userId
    tokenStore.set(token, userId);

    res.cookie('remember_me', token, {
        httpOnly: true,  // Prevents client-side JS access
        secure: true,    // Ensures cookie is only sent over HTTPS
        sameSite: 'strict', // Prevents CSRF attacks
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
}

/**
 * Middleware to authenticate a user via the remember-me cookie.
 * Rotates the token on successful authentication to prevent theft.
 */
function authenticateRememberMe(req, res, next) {
    const token = req.cookies.remember_me;

    if (!token) {
        return next();
    }

    // Check if token exists in server-side store
    if (tokenStore.has(token)) {
        const userId = tokenStore.get(token);

        // --- ROTATION LOGIC ---
        // 1. Remove the old token from storage
        tokenStore.delete(token);

        // 2. Generate a new token
        const newToken = generateToken();

        // 3. Store the new token
        tokenStore.set(newToken, userId);

        // 4. Update the cookie with the new token
        res.cookie('remember_me', newToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        // Attach user to request object
        req.user = { id: userId };
    }

    next();
}

// --- ROUTES ---

// Login route: Sets the remember-me cookie
app.post('/login', (req, res) => {
    const { username } = req.body;
    // Simulate user lookup
    const userId = 'user_' + username;

    setRememberMeCookie(res, userId);
    res.json({ message: 'Logged in successfully' });
});

// Logout route: Clears the cookie
app.post('/logout', (req, res) => {
    const token = req.cookies.remember_me;
    if (token) {
        tokenStore.delete(token);
    }
    res.clearCookie('remember_me', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
});

// Protected route: Requires authentication
app.get('/profile', authenticateRememberMe, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    res.json({ message: `Welcome to your profile, User ID: ${req.user.id}` });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});