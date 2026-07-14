const crypto = require('crypto');
const express = require('express');

// In-memory store for demonstration purposes. 
// In production, use a database (e.g., Redis, PostgreSQL) with an index on the token hash.
const rememberMeTokens = new Map();

/**
 * Generates a cryptographically secure random token.
 * @returns {string} A hex-encoded random string.
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes the token for secure storage.
 * @param {string} token - The plain text token.
 * @returns {string} The hashed token.
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Sets the remember-me cookie and stores the token mapping server-side.
 * @param {object} res - Express response object.
 * @param {string} userId - The unique identifier of the user.
 * @param {number} expiresInDays - Number of days until the token expires.
 */
function setRememberMeCookie(res, userId, expiresInDays = 30) {
    const plainToken = generateToken();
    const hashedToken = hashToken(plainToken);
    
    // Store the hashed token mapped to the user ID and expiration time
    rememberMeTokens.set(hashedToken, {
        userId: userId,
        expiresAt: Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)
    });

    // Set the cookie with secure attributes
    res.cookie('remember_me', plainToken, {
        httpOnly: true,   // Prevents client-side JavaScript access
        secure: true,     // Ensures cookie is only sent over HTTPS
        sameSite: 'Strict', // Prevents CSRF attacks
        maxAge: expiresInDays * 24 * 60 * 60 * 1000, // Cookie expiration time
        path: '/'         // Cookie available across the entire site
    });
}

/**
 * Validates and rotates the remember-me token.
 * @param {object} req - Express request object.
 * @returns {object|null} An object containing userId if valid, null otherwise.
 */
function validateAndRotateToken(req) {
    const plainToken = req.cookies.remember_me;

    if (!plainToken) {
        return null;
    }

    const hashedToken = hashToken(plainToken);
    const tokenData = rememberMeTokens.get(hashedToken);

    // Check if token exists and is not expired
    if (!tokenData || Date.now() > tokenData.expiresAt) {
        // Clear the cookie if invalid or expired
        req.res.clearCookie('remember_me');
        return null;
    }

    const userId = tokenData.userId;

    // Rotate the token: delete old token and create a new one
    rememberMeTokens.delete(hashedToken);
    
    // Generate new token and set it in the response
    setRememberMeCookie(req.res, userId, 30); // Re-set with same expiration logic or adjust as needed

    return { userId };
}

// Example Express route setup for demonstration
const app = express();
app.use(express.json());
app.use(require('cookie-parser')());

// Middleware to validate remember-me token
app.use((req, res, next) => {
    const result = validateAndRotateToken(req);
    if (result) {
        req.user = { id: result.userId }; // Attach user info to request
    }
    next();
});

// Example login endpoint that sets the remember-me cookie
app.post('/login', (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // Simulate successful authentication
    setRememberMeCookie(res, userId);
    res.json({ message: 'Login successful', userId });
});

// Example logout endpoint that clears the remember-me cookie
app.post('/logout', (req, res) => {
    const plainToken = req.cookies.remember_me;
    
    if (plainToken) {
        const hashedToken = hashToken(plainToken);
        rememberMeTokens.delete(hashedToken); // Remove from server-side storage
    }

    res.clearCookie('remember_me');
    res.json({ message: 'Logged out successfully' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { setRememberMeCookie, validateAndRotateToken };