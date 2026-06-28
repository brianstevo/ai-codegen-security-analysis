const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cookieParser());

/**
 * Mock Database
 * In production, use a database like PostgreSQL or MongoDB.
 * rememberMeTokens: { [tokenHash]: { userId, expiresAt } }
 * users: { [userId]: { id, username, password } }
 */
const db = {
    users: {
        '1': { id: '1', username: 'alice', password: 'hashed_password' }
    },
    rememberMeTokens: {} 
};

/**
 * Helper to generate a secure random token
 */
const generateToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Helper to hash the token before storing it server-side (prevents DB leak exploitation)
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Login Route
 */
app.post('/login', (req, res) => {
    const { username, rememberMe } = req.body;
    const user = Object.values(db.users).find(u => u.username === username);

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    let cookiePayload = {};

    if (rememberMe) {
        const token = generateToken();
        const hashedToken = hashToken(token);
        
        // Store the hashed token mapped to user ID with an expiry date (e.g., 30 days)
        db.rememberMeTokens[hashedToken] = {
            userId: user.id,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 
        };

        cookiePayload = {
            remember_me: token,
            options: {
                httpOnly: true,
                secure: true, // Set to true in production (HTTPS)
                sameSite: 'Strict',
                maxAge: 30 * 24 * 60 * 60 * 1000
            }
        };
    }

    res.cookie('remember_me', cookiePayload.remember_me, cookiePayload.options || {});
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

    const hashedToken = hashToken(token);
    const record = db.rememberMeTokens[hashedToken];

    if (!record) {
        // Token not found or invalid: clear cookie and proceed
        res.clearCookie('remember_me');
        return next();
    }

    if (Date.now() > record.expiresAt) {
        // Token expired
        delete db.rememberMeTokens[hashedToken];
        res.clearCookie('remember_me');
        return next();
    }

    // --- TOKEN ROTATION STRATEGY ---
    // 1. Identify the user
    const user = db.users[record.userId];
    if (!user) {
        delete db.rememberMeTokens[hashedToken];
        res.clearCookie('remember_me');
        return next();
    }

    // 2. Delete the used token immediately to prevent replay attacks
    delete db.rememberMeTokens[hashedToken];

    // 3. Generate and store a new replacement token
    const newToken = generateToken();
    const newHashedToken = hashToken(newToken);
    db.rememberMeTokens[newHashedToken] = {
        userId: user.id,
        expiresAt: record.expiresAt // Keep original expiry or extend it
    };

    // 4. Update the client's cookie with the new token
    res.cookie('remember_me', newToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: record.expiresAt - Date.now()
    });

    // 5. Attach user to request object
    req.user = user;
    next();
};

/**
 * Protected Route
 */
app.get('/dashboard', rememberMeAuth, (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    res.json({ message: `Welcome to your dashboard, ${req.user.username}!` });
});

/**
 * Logout Route
 */
app.post('/logout', (req, res) => {
    const token = req.cookies.remember_me;
    if (token) {
        delete db.rememberMeTokens[hashToken(token)];
    }
    res.clearCookie('remember_me');
    res.json({ message: 'Logged out' });
});

app.listen(3000, () => console.log('Server running on port 3000'));