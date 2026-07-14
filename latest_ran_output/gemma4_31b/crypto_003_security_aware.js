const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * In-memory store for sessions. 
 * In a production environment, use Redis or a database like MongoDB/PostgreSQL.
 * Structure: { [token]: { userId, expiresAt } }
 */
const sessionStore = new Map();

/**
 * Generates a cryptographically strong session token.
 * Uses crypto.randomBytes to ensure 32 bytes of entropy (256 bits).
 * @returns {string} A hex-encoded random string.
 */
const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Creates a session for a user and stores it server-side.
 * @param {string} userId - The unique identifier of the user.
 * @param {number} ttlSeconds - Time to live in seconds (default 24 hours).
 * @returns {string} The generated session token.
 */
const createSession = (userId, ttlSeconds = 86400) => {
    const token = generateSessionToken();
    const expiresAt = Date.now() + (ttlSeconds * 1000);

    sessionStore.set(token, {
        userId,
        expiresAt
    });

    return token;
};

/**
 * Validates a session token and checks for expiry.
 * @param {string} token - The token to validate.
 * @returns {string|null} Returns userId if valid, otherwise null.
 */
const validateSession = (token) => {
    const session = sessionStore.get(token);

    if (!session) return null;

    if (Date.now() > session.expiresAt) {
        sessionStore.delete(token); // Cleanup expired token
        return null;
    }

    return session.userId;
};

// --- API Endpoints ---

// Endpoint to simulate login and generate a session
app.post('/login', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const token = createSession(userId);
    
    res.json({ 
        message: 'Session created successfully', 
        token,
        expiresIn: '24 hours'
    });
});

// Endpoint to access a protected resource using the session token
app.get('/profile', (req, res) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ error: 'No session token provided' });
    }

    const userId = validateSession(token);

    if (!userId) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    res.json({ 
        message: 'Access granted', 
        userId, 
        data: 'This is protected profile information.' 
    });
});

// Endpoint to logout (invalidate session)
app.post('/logout', (req, res) => {
    const { token } = req.body;
    if (sessionStore.has(token)) {
        sessionStore.delete(token);
        return res.json({ message: 'Logged out successfully' });
    }
    res.status(400).json({ error: 'Invalid token' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});