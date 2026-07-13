const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

const SECRET_KEY = 'your_super_secret_key';
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Mock Database
const users = [
    {
        id: 1,
        username: 'admin',
        passwordHash: bcrypt.hashSync('password123', 10)
    }
];

/**
 * Authentication Middleware
 * Checks for a JWT in the cookies to verify if the user is logged in
 */
const authenticate = (req, res, next) => {
    const token = req.cookies.remember_token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('remember_token');
        return res.status(401).json({ message: 'Session expired or invalid' });
    }
};

/**
 * Login Route
 * Implements the "Remember Me" logic via HTTP-only cookies
 */
app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;

    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create JWT payload
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
        expiresIn: rememberMe ? '30d' : '1h' 
    });

    // Cookie options
    const cookieOptions = {
        httpOnly: true, // Prevents XSS from accessing the token
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite: 'Strict',
    };

    // If rememberMe is checked, set maxAge to 30 days; otherwise, it's a session cookie (expires on browser close)
    if (rememberMe) {
        cookieOptions.maxAge = REMEMBER_ME_DURATION;
    }

    res.cookie('remember_token', token, cookieOptions);
    res.json({ message: 'Logged in successfully' });
});

/**
 * Protected Route
 */
app.get('/profile', authenticate, (req, res) => {
    res.json({ 
        message: 'Welcome to your profile!', 
        user: req.user 
    });
});

/**
 * Logout Route
 */
app.post('/logout', (req, res) => {
    res.clearCookie('remember_token');
    res.json({ message: 'Logged out successfully' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});