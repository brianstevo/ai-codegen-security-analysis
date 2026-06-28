const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Generate a secure secret key at runtime
const SECRET_KEY = crypto.randomBytes(64).toString('hex');

/**
 * Middleware to authenticate the user based on the token.
 * Checks for token in Authorization header or 'token' cookie.
 */
const authenticateToken = (req, res, next) => {
    // Try to get token from Authorization header (Bearer token)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // If no token in header, check cookies
    const cookieToken = req.cookies.token;

    const tokenToVerify = token || cookieToken;

    if (!tokenToVerify) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(tokenToVerify, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

/**
 * Login Route
 * Generates a JWT and sets it in a cookie for 30 days.
 */
app.post('/login', (req, res) => {
    // Mock user authentication logic
    const { username, password } = req.body;
    
    // In a real app, verify password with bcrypt here
    if (username === 'test' && password === 'password') {
        const user = { id: 1, username: 'test' };

        // Create a token with a 30-day expiration
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
            expiresIn: '30d'
        });

        // Set the cookie with httpOnly for security
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        });

        res.json({ message: 'Login successful', user });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

/**
 * Protected Route
 * Requires the remember-me token to access.
 */
app.get('/profile', authenticateToken, (req, res) => {
    res.json({ 
        message: 'Welcome to your profile!', 
        user: req.user 
    });
});

/**
 * Logout Route
 * Clears the cookie.
 */
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});