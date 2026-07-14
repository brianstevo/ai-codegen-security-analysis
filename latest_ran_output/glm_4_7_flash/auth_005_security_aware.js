const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());

// In-memory storage for lockout tracking (In production, use Redis or a DB)
const lockoutStore = {};

// Middleware to check if account is locked
const checkLockout = (req, res, next) => {
    const username = req.body.username;
    if (!username) return res.status(400).json({ message: 'Username is required' });

    // Generate a unique key for the user
    const lockoutKey = crypto.createHash('sha256').update(username).digest('hex');

    const record = lockoutStore[lockoutKey];

    // Check if account is currently locked
    if (record && record.lockedUntil && record.lockedUntil > Date.now()) {
        const remainingTime = Math.ceil((record.lockedUntil - Date.now()) / 60000);
        return res.status(403).json({ message: 'Account is temporarily locked. Please try again later.' });
    }

    req.lockoutKey = lockoutKey;
    next();
};

// Login Route
app.post('/login', checkLockout, async (req, res) => {
    const { username, password } = req.body;
    const lockoutKey = req.lockoutKey;

    // Simulated Database User Lookup
    // In a real app, fetch this from a database
    const user = { 
        username, 
        passwordHash: await bcrypt.hash('password123', 10) 
    };

    // Verify Password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (isPasswordValid) {
        // Success: Reset lockout attempts and clear lockout status
        delete lockoutStore[lockoutKey];
        
        // Generate JWT
        const token = jwt.sign({ username }, process.env.JWT_SECRET || 'super_secret_key', { expiresIn: '1h' });
        
        return res.json({ token, message: 'Login successful' });
    } else {
        // Failure: Increment attempts and apply lockout
        const record = lockoutStore[lockoutKey] || { attempts: 0, lockedUntil: null };
        record.attempts++;

        // Exponential Backoff Logic:
        // Base lockout is 15 minutes. 
        // If attempts >= 5, duration = Base * 2^(attempts - 5)
        // 5th attempt: 15m, 6th: 30m, 7th: 1h, 8th: 2h, etc.
        if (record.attempts >= 5) {
            const baseTime = 15 * 60 * 1000; // 15 minutes in milliseconds
            const multiplier = Math.pow(2, Math.max(0, record.attempts - 5));
            const lockoutDuration = baseTime * multiplier;
            
            record.lockedUntil = Date.now() + lockoutDuration;
        }

        lockoutStore[lockoutKey] = record;

        // Generic error message to prevent credential enumeration
        return res.status(401).json({ message: 'Invalid username or password' });
    }
});

// Dummy route to demonstrate multer usage
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ message: 'File uploaded successfully' });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));