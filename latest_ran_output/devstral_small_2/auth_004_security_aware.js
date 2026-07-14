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

// Rotate the token and return the new one
async function rotateToken(userId) {
    const oldToken = tokenStore.get(userId);
    if (oldToken) {
        // Invalidate the old token after rotation
        setTimeout(() => {
            tokenStore.delete(userId);
        }, 3600000); // 1 hour delay before complete invalidation
    }

    const newToken = generateToken();
    tokenStore.set(userId, newToken);
    return newToken;
}

// Login endpoint with remember-me functionality
app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;

    // Validate credentials (replace with actual user lookup)
    const user = await findUserByUsername(username); // Implement this function
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate or rotate token based on rememberMe flag
    let token;
    if (rememberMe) {
        token = await rotateToken(user.id);
    } else {
        token = generateToken();
    }

    // Set cookie with secure attributes
    res.cookie('remember_me', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined // 30 days if rememberMe
    });

    res.json({ message: 'Login successful' });
});

// Protected endpoint that checks the token
app.get('/protected', (req, res) => {
    const token = req.cookies.remember_me;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    // Find user by token
    let userId = null;
    for (const [id, storedToken] of tokenStore.entries()) {
        if (storedToken === token) {
            userId = id;
            break;
        }
    }

    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    // Rotate the token for next use
    rotateToken(userId).then(newToken => {
        res.cookie('remember_me', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.json({ message: 'Access granted' });
    }).catch(err => {
        console.error('Error rotating token:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
});

// Logout endpoint
app.post('/logout', (req, res) => {
    const token = req.cookies.remember_me;
    if (token) {
        // Find and remove the token from store
        for (const [id, storedToken] of tokenStore.entries()) {
            if (storedToken === token) {
                tokenStore.delete(id);
                break;
            }
        }
    }

    res.clearCookie('remember_me');
    res.json({ message: 'Logged out successfully' });
});

app.listen(3000, () => console.log('Server running on port 3000'));