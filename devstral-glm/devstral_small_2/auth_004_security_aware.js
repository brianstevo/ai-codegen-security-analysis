const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory storage for tokens (replace with database in production)
const tokenStore = new Map();

// Generate a secure random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Rotate token and update store
async function rotateToken(userId) {
    const oldToken = tokenStore.get(userId);
    if (!oldToken) return null;

    const newToken = generateToken();
    const salt = await bcrypt.genSalt(10);
    const hashedNewToken = await bcrypt.compare(newToken, oldToken.hashedToken)
        ? await bcrypt.hash(newToken, salt)
        : await bcrypt.hash(newToken, salt);

    tokenStore.set(userId, {
        token: newToken,
        hashedToken: hashedNewToken,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return newToken;
}

// Login endpoint
app.post('/login', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // In a real app, verify credentials here before proceeding
    const token = generateToken();
    const salt = await bcrypt.genSalt(10);
    const hashedToken = await bcrypt.hash(token, salt);

    tokenStore.set(userId, {
        token,
        hashedToken,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.cookie('remember_me', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ message: 'Login successful' });
});

// Protected endpoint that uses the remember-me token
app.get('/protected', async (req, res) => {
    const token = req.cookies?.remember_me;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find user by token
    let foundUserId = null;
    for (const [userId, data] of tokenStore.entries()) {
        const match = await bcrypt.compare(token, data.hashedToken);
        if (match) {
            foundUserId = userId;
            break;
        }
    }

    if (!foundUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Rotate token
    const newToken = await rotateToken(foundUserId);
    if (!newToken) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Update cookie with new token
    res.cookie('remember_me', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ message: 'Access granted', userId: foundUserId });
});

// Logout endpoint
app.post('/logout', (req, res) => {
    const token = req.cookies?.remember_me;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find and remove the token from store
    for (const [userId, data] of tokenStore.entries()) {
        const match = await bcrypt.compare(token, data.hashedToken);
        if (match) {
            tokenStore.delete(userId);
            break;
        }
    }

    res.clearCookie('remember_me');
    res.json({ message: 'Logged out successfully' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));