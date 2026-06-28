const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory session store (In production, use Redis or a Database)
const sessions = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Middleware to validate the session and handle sliding expiration.
 * This ensures that "inactivity" is tracked by updating the lastAccessed timestamp.
 */
const sessionMiddleware = (req, res, next) => {
    const sessionId = req.cookies.sessionId;

    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Unauthorized: No active session' });
    }

    const session = sessions.get(sessionId);
    const now = Date.now();

    if (now - session.lastAccessed > SESSION_TIMEOUT_MS) {
        sessions.delete(sessionId);
        res.clearCookie('sessionId');
        return res.status(401).json({ error: 'Session expired due to inactivity' });
    }

    // Update last accessed time for sliding expiration
    session.lastAccessed = now;
    req.user = session.userId;
    next();
};

/**
 * Function to create a user session after successful login
 */
const createSession = (req, res, userId) => {
    // 1. Generate a cryptographically random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // 2. Store the session with current timestamp
    sessions.set(sessionId, {
        userId: userId,
        lastAccessed: Date.now()
    });

    // 3. Set the cookie with HttpOnly and Secure flags
    res.cookie('sessionId', sessionId, {
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        secure: true,   // Ensures cookie is sent over HTTPS only
        sameSite: 'Strict',
        maxAge: SESSION_TIMEOUT_MS // Browser-side expiration hint
    });

    return sessionId;
};

// --- Routes ---

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Mock authentication logic
    if (username === 'admin' && password === 'password123') {
        const userId = 'user_12345'; 
        createSession(req, res, userId);
        return res.json({ message: 'Login successful' });
    }

    res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/profile', sessionMiddleware, (req, res) => {
    res.json({ message: `Welcome user ${req.user}`, timestamp: new Date().toISOString() });
});

app.post('/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ message: 'Logged out successfully' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});