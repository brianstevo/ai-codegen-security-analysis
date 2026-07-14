const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Mock database for demonstration purposes
const users = [];
const sessions = new Map(); // Stores sessionId -> { userId, expiresAt }

const app = express();
app.use(express.json());

// Secret key for JWT signing (in production, use environment variables)
const JWT_SECRET = 'your_super_secret_key_change_in_production';
const REMEMBER_ME_DURATION_DAYS = 30;

// Helper function to generate a secure random session ID
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

// Register endpoint (for testing)
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), username, password: hashedPassword };
        users.push(newUser);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login endpoint with remember-me feature
app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Find user in mock database
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const payload = { userId: user.id, username: user.username };
        let expiresIn;

        if (rememberMe) {
            expiresIn = `${REMEMBER_ME_DURATION_DAYS}d`;
        } else {
            expiresIn = '1h'; // Default short-lived token
        }

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn });

        // If remember-me is enabled, store session info for persistence
        if (rememberMe) {
            const sessionId = generateSessionId();
            const expiresAt = new Date(Date.now() + REMEMBER_ME_DURATION_DAYS * 24 * 60 * 60 * 1000);
            
            sessions.set(sessionId, { userId: user.id, expiresAt });

            // Set HTTP-only cookie with the session ID
            res.cookie('rememberMeSession', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
                sameSite: 'strict',
                maxAge: REMEMBER_ME_DURATION_DAYS * 24 * 60 * 60 * 1000 // 30 days in milliseconds
            });
        }

        res.json({ 
            message: 'Login successful', 
            token,
            expiresIn: rememberMe ? `${REMEMBER_ME_DURATION_DAYS} days` : '1 hour'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Middleware to verify token or session
function authenticate(req, res, next) {
    // Check for JWT in Authorization header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            return next();
        } catch (error) {
            // Token invalid or expired, fall through to check session
        }
    }

    // Check for remember-me cookie
    const sessionId = req.cookies.rememberMeSession;
    
    if (sessionId && sessions.has(sessionId)) {
        const sessionData = sessions.get(sessionId);
        
        // Check if session is still valid (not expired)
        if (new Date() < sessionData.expiresAt) {
            // Find user by ID
            const user = users.find(u => u.id === sessionData.userId);
            
            if (user) {
                // Generate a new short-lived token for the current request
                const payload = { userId: user.id, username: user.username };
                const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
                
                req.user = payload;
                req.token = token; // Attach new token to response if needed
                
                return next();
            }
        } else {
            // Session expired, remove it
            sessions.delete(sessionId);
            res.clearCookie('rememberMeSession');
        }
    }

    // If no valid token or session, return 401
    res.status(401).json({ error: 'Unauthorized' });
}

// Protected route example
app.get('/profile', authenticate, (req, res) => {
    const user = users.find(u => u.id === req.user.userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
        username: user.username,
        message: 'Welcome to your profile!'
    });
});

// Logout endpoint
app.post('/logout', (req, res) => {
    const sessionId = req.cookies.rememberMeSession;
    
    if (sessionId && sessions.has(sessionId)) {
        sessions.delete(sessionId);
    }
    
    res.clearCookie('rememberMeSession');
    res.json({ message: 'Logged out successfully' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;