const crypto = require('crypto');
const express = require('express');

// In-memory store for demonstration purposes. 
// In production, use a database like Redis or PostgreSQL.
const rememberMeTokens = new Map();

/**
 * Generates a cryptographically secure random token.
 * @returns {string} A hex-encoded random string.
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Implements the secure remember-me feature logic.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} userId - The ID of the authenticated user
 * @param {number} tokenExpiryDays - Number of days until the token expires (default: 30)
 */
function setRememberMeToken(req, res, userId, tokenExpiryDays = 30) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    // 1. Generate a new secure random token
    const newToken = generateToken();
    
    // 2. Calculate expiration date
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + tokenExpiryDays);

    // 3. Store the token mapped to the user ID server-side
    // We store an object with the userId and expiry for validation
    rememberMeTokens.set(newToken, {
        userId: userId,
        expiresAt: expiryDate.getTime()
    });

    // 4. Set the cookie with secure attributes
    res.cookie('remember_me', newToken, {
        httpOnly: true,      // Prevents client-side JavaScript access (XSS protection)
        secure: true,        // Ensures cookie is only sent over HTTPS
        sameSite: 'Strict',  // Prevents CSRF attacks by restricting cross-site requests
        expires: expiryDate, // Sets the expiration time on the client side
        path: '/'            // Makes the cookie available across the entire site
    });

    return newToken;
}

/**
 * Validates and rotates the remember-me token.
 * This function should be called during middleware or authentication checks.
 * 
 * @param {Object} req - Express request object
 * @returns {number|null} The userId if valid, null otherwise
 */
function validateAndRotateToken(req) {
    const token = req.cookies?.remember_me;

    if (!token) {
        return null;
    }

    // 1. Look up the token in the server-side store
    const tokenData = rememberMeTokens.get(token);

    if (!tokenData) {
        // Token not found, clear cookie to prevent replay attempts with invalid tokens
        res.clearCookie('remember_me');
        return null;
    }

    // 2. Check if the token has expired
    const now = Date.now();
    if (now > tokenData.expiresAt) {
        // Token expired, remove from store and clear cookie
        rememberMeTokens.delete(token);
        res.clearCookie('remember_me');
        return null;
    }

    const userId = tokenData.userId;

    // 3. Rotate the token: Delete old token and create a new one
    rememberMeTokens.delete(token);
    
    // Generate a new token for the same user with the same remaining validity or reset it
    // Here we reset the expiry to extend the session, which is common for "remember me"
    const newToken = generateToken();
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 30); // Reset to 30 days from now

    rememberMeTokens.set(newToken, {
        userId: userId,
        expiresAt: newExpiryDate.getTime()
    });

    // 4. Set the new cookie with the rotated token
    res.cookie('remember_me', newToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        expires: newExpiryDate,
        path: '/'
    });

    return userId;
}

// Example usage in an Express app context
const app = express();
app.use(express.json());

// Middleware to parse cookies (usually handled by cookie-parser)
// For this example, we assume req.cookies is available or use a simple parser
app.use((req, res, next) => {
    // Simple cookie parsing for demonstration if cookie-parser isn't used
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        req.cookies = {};
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            req.cookies[name] = decodeURIComponent(value);
        });
    } else {
        req.cookies = {};
    }
    next();
});

// Login endpoint example
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Mock authentication logic
    if (username === 'test' && password === 'password') {
        const userId = 123; // Mock user ID
        
        try {
            setRememberMeToken(req, res, userId);
            res.json({ success: true, message: 'Logged in successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to set remember me token' });
        }
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Protected route example that validates and rotates the token
app.get('/protected', (req, res) => {
    const userId = validateAndRotateToken(req);
    
    if (userId) {
        res.json({ success: true, message: `Access granted for user ${userId}` });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

// Logout endpoint to clear the remember-me token
app.post('/logout', (req, res) => {
    const token = req.cookies?.remember_me;
    if (token) {
        rememberMeTokens.delete(token);
    }
    res.clearCookie('remember_me');
    res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = { app, setRememberMeToken, validateAndRotateToken };