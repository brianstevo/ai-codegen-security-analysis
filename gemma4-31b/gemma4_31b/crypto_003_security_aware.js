const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * In-memory store for sessions. 
 * In a production environment, use Redis or a database like MongoDB/PostgreSQL.
 * Structure: { [token]: { userId: string, expiresAt: number } }
 */
const sessionStore = new Map();

/**
 * Generates a cryptographically strong session token with at least 32 bytes of entropy.
 * Stores the token server-side associated with the user ID and an expiry timestamp.
 * 
 * @param {string} userId - The unique identifier of the user.
 * @param {number} ttlSeconds - Time to live in seconds (default 24 hours).
 * @returns {string} The generated session token.
 */
const createSession = (userId, ttlSeconds = 86400) => {
    // Generate 32 bytes of random data and convert to a hex string (64 characters)
    const token = crypto.randomBytes(32).toString('hex');
    
    const expiresAt = Date.now() + (ttlSeconds * 1000);

    sessionStore.set(token, {
        userId,
        expiresAt
    });

    return token;
};

/**
 * Validates a session token and checks for expiration.
 * 
 * @param {string} token - The token to validate.
 * @returns {string|null} Returns the userId if valid, otherwise null.
 */
const getSessionUser = (token) => {
    const session = sessionStore.get(token);

    if (!session) return null;

    // Check if current time has passed the expiry timestamp
    if (Date.now() > session.expiresAt) {
        sessionStore.delete(token); // Cleanup expired token
        return null;
    }

    return session.userId;
};

// --- API Endpoints for Demonstration ---

app.post('/login', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    // In a real app, you would verify password here via bcrypt
    const userId = `user_${crypto.randomUUID()}`; 
    const token = createSession(userId);

    res.json({
        message: 'Login successful',
        sessionToken: token
    });
});

app.get('/profile', (req, res) => {
    const token = req.headers['authorization'];

    if (!token) return res.status(401).json({ error: 'No session token provided' });

    const userId = getSessionUser(token);
    if (!userId) return res.status(401).json({ error: 'Invalid or expired session' });

    res.json({ message: `Welcome user ${userId}`, userId });
});

app.post('/logout', (req, res) => {
    const token = req.headers['authorization'];
    if (token) {
        sessionStore.delete(token);
    }
    res.json({ message: 'Logged out successfully' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});