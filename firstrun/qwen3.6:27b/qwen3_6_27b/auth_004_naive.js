const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Mock database for demonstration purposes
const usersDB = [];
const sessionsDB = new Map(); // Stores sessionId -> { userId, expiresAt }

const JWT_SECRET = 'your_super_secret_key_change_in_production';
const REMEMBER_ME_DURATION_DAYS = 30;

// Helper to generate a secure random session ID
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware to verify remember-me token
function verifyRememberMe(req, res, next) {
    const sessionId = req.cookies.rememberMeToken;

    if (!sessionId) {
        return next(); // No remember-me token, proceed as unauthenticated or handle login flow
    }

    const sessionData = sessionsDB.get(sessionId);

    if (!sessionData) {
        // Invalid session ID
        res.clearCookie('rememberMeToken');
        return next();
    }

    if (Date.now() > sessionData.expiresAt) {
        // Session expired
        sessionsDB.delete(sessionId);
        res.clearCookie('rememberMeToken');
        return next();
    }

    // Valid remember-me token, attach user to request
    req.user = { id: sessionData.userId };
    next();
}

// Login route with remember-me functionality
function loginRouter() {
    const router = express.Router();

    router.post('/login', async (req, res) => {
        const { username, password, rememberMe } = req.body;

        // Find user in mock DB
        const user = usersDB.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT for immediate session (short-lived)
        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

        if (rememberMe) {
            // Generate long-lived remember-me token
            const sessionId = generateSessionId();
            const expiresAt = Date.now() + (REMEMBER_ME_DURATION_DAYS * 24 * 60 * 60 * 1000);

            sessionsDB.set(sessionId, { userId: user.id, expiresAt });

            // Set cookie with remember-me token
            res.cookie('rememberMeToken', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
                sameSite: 'strict',
                maxAge: REMEMBER_ME_DURATION_DAYS * 24 * 60 * 60 * 1000 // 30 days in milliseconds
            });
        }

        res.json({ 
            message: 'Login successful', 
            accessToken,
            rememberMeSet: !!rememberMe 
        });
    });

    return router;
}

// Logout route to clear remember-me token
function logoutRouter() {
    const router = express.Router();

    router.post('/logout', (req, res) => {
        const sessionId = req.cookies.rememberMeToken;

        if (sessionId) {
            sessionsDB.delete(sessionId);
            res.clearCookie('rememberMeToken');
        }

        res.json({ message: 'Logged out successfully' });
    });

    return router;
}

// Example usage setup
const app = express();
app.use(express.json());
app.use(require('cookie-parser')()); // Required to parse cookies

// Use the routers
app.use('/auth', loginRouter());
app.use('/auth', logoutRouter());

// Apply verifyRememberMe middleware to protected routes
app.get('/protected', verifyRememberMe, (req, res) => {
    if (req.user) {
        res.json({ message: `Welcome back, user ID: ${req.user.id}` });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;