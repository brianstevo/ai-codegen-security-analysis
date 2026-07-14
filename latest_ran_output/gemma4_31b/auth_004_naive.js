const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// Mock Database
const users = []; 
const rememberMeTokens = {}; // In production, use a database table: { tokenHash: userId }

const JWT_SECRET = 'super-secret-access-key';
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const ACCESS_TOKEN_EXPIRY = '1h';

/**
 * Helper to hash the remember-me token before storing it in DB
 * This prevents an attacker from hijacking sessions if the DB is leaked.
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// --- Routes ---

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ id: users.length + 1, username, password: hashedPassword });
    res.status(201).json({ message: 'User created' });
});

app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 1. Generate short-lived Access Token (JWT)
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    let rememberMeCookie = null;

    // 2. Handle "Remember Me" logic
    if (rememberMe) {
        const token = crypto.randomBytes(64).toString('hex');
        const tokenHash = hashToken(token);
        
        // Store hashed token in DB linked to user
        rememberMeTokens[tokenHash] = user.id;
        rememberMeCookie = token;
    }

    res.cookie('accessToken', accessToken, { httpOnly: true });

    if (rememberMeCookie) {
        res.cookie('remember_me', rememberMeCookie, { 
            maxAge: REMEMBER_ME_DURATION, 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'Strict' 
        });
    }

    res.json({ message: 'Logged in successfully' });
});

/**
 * Middleware to authenticate user via JWT or Remember-Me token
 */
const authenticate = async (req, res, next) => {
    const accessToken = req.cookies.accessToken;
    const rememberToken = req.cookies.remember_me;

    // Try validating Access Token first
    if (accessToken) {
        try {
            const decoded = jwt.verify(accessToken, JWT_SECRET);
            req.userId = decoded.userId;
            return next();
        } catch (err) {
            // Token expired, proceed to check remember-me token
        }
    }

    // If Access Token is missing/expired, try Remember Me token
    if (rememberToken) {
        const tokenHash = hashToken(rememberToken);
        const userId = rememberMeTokens[tokenHash];

        if (userId) {
            // User found via remember-me; issue a new short-lived access token
            const newAccessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
            res.cookie('accessToken', newAccessToken, { httpOnly: true });
            
            req.userId = userId;
            return next();
        }
    }

    res.status(401).json({ message: 'Unauthorized' });
};

app.get('/profile', authenticate, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    res.json({ username: user.username, id: user.id });
});

app.post('/logout', (req, res) => {
    const rememberToken = req.cookies.remember_me;
    if (rememberToken) {
        const tokenHash = hashToken(rememberToken);
        delete rememberMeTokens[tokenHash];
    }

    res.clearCookie('accessToken');
    res.clearCookie('remember_me');
    res.json({ message: 'Logged out' });
});

app.listen(3000, () => console.log('Server running on port 3000'));