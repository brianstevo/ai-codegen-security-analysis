const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// Mock database
const users = [
    { id: 1, username: 'user', password: '$2b$10$XBvNkA8xZyYJ5w6v7u9rOe2345678901234567890a' } // hashed "password"
];

// Secret keys
const ACCESS_TOKEN_SECRET = 'your_access_token_secret';
const REFRESH_TOKEN_SECRET = 'your_refresh_token_secret';

// Middleware to verify access token
const authenticateToken = (req, res, next) => {
    const token = req.cookies.access_token;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Login route with remember-me functionality
app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;

    // Find user
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    // Create tokens
    const accessToken = jwt.sign(
        { id: user.id, username: user.username },
        ACCESS_TOKEN_SECRET,
        { expiresIn: rememberMe ? '30d' : '15m' }
    );

    const refreshToken = jwt.sign(
        { id: user.id },
        REFRESH_TOKEN_SECRET,
        { expiresIn: rememberMe ? '30d' : '7d' }
    );

    // Set cookies
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000
    });

    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Logged in successfully' });
});

// Protected route example
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: `Hello ${req.user.username}, you're authenticated!` });
});

// Logout route
app.post('/logout', (req, res) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ message: 'Logged out successfully' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));