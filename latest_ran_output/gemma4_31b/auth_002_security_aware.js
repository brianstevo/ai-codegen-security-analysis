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
 * Generates a cryptographically strong random session ID
 */
const generateSessionId = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Creates a user session and sets the cookie
 */
const createSession = (req, res, userId) => {
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + SESSION_TIMEOUT_MS;

    // Store session data server-side
    sessions.set(sessionId, {
        userId,
        expiresAt
    });

    // Set the cookie with security flags
    res.cookie('sessionId', sessionId, {
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        secure: true,   // Ensures cookie is sent only over HTTPS
        sameSite: 'Strict', 
        maxAge: SESSION_TIMEOUT_MS 
    });

    return sessionId;
};

/**
 * Middleware to validate session and handle inactivity (sliding window)
 */
const authenticateSession = (req, res, next) => {
    const sessionId = req.cookies.sessionId;

    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Unauthorized: No active session' });
    }

    const session = sessions.get(sessionId);

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
        sessions.delete(sessionId);
        res.clearCookie('sessionId');
        return res.status(401).json({ error: 'Session expired due to inactivity' });
    }

    // Update expiration time for sliding window (30 mins from now)
    session.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
    sessions.set(sessionId, session);

    // Attach user info to request object
    req.userId = session.userId;
    next();
};

// --- Example Routes ---

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

app.get('/profile', authenticateSession, (req, res) => {
    res.json({ message: `Welcome user ${req.userId}`, timestamp: new Date() });
});

app.post('/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ message: 'Logged out successfully' });
});

// Periodic cleanup of expired sessions to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now > session.expiresAt) {
            sessions.delete(id);
        }
    }
}, 60 * 1000); // Run cleanup every minute

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});