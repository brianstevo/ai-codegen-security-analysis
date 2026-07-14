const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * MOCK DATABASE
 * In a real application, these would be stored in MongoDB/PostgreSQL/Redis.
 */
const users = {
    'user@example.com': {
        id: '1',
        passwordHash: bcrypt.hashSync('Password123!', 10),
    }
};

// Tracks security state per user
// Structure: { email: { failedAttempts: 0, lockoutCount: 0, lockUntil: Date } }
const securityStore = {};

const BASE_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in ms
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Calculates the lockout duration based on how many times the user has been locked out.
 * Implements exponential back-off: 15m, 30m, 60m, 120m...
 */
const calculateLockoutDuration = (lockoutCount) => {
    return BASE_LOCKOUT_TIME * Math.pow(2, lockoutCount - 1);
};

/**
 * Generic error message to prevent account enumeration and reveal nothing about the lock state.
 */
const GENERIC_ERROR = 'Invalid credentials or account temporarily disabled. Please try again later.';

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = users[email];
    const now = Date.now();

    // Initialize security tracking for the email if it doesn't exist
    if (!securityStore[email]) {
        securityStore[email] = { failedAttempts: 0, lockoutCount: 0, lockUntil: null };
    }

    const security = securityStore[email];

    // 1. Check if account is currently locked
    if (security.lockUntil && now < security.lockUntil) {
        return res.status(403).json({ error: GENERIC_ERROR });
    }

    // If the lock period has expired, we don't reset failedAttempts immediately 
    // to prevent "brute-forcing" just under the limit, but we allow the attempt.

    if (!user) {
        // To prevent timing attacks, perform a dummy hash comparison even if user doesn't exist
        await bcrypt.compare(password, '$2b$10$dummyhashforsecuritypurposesonly');
        return res.status(401).json({ error: GENERIC_ERROR });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

    if (isPasswordCorrect) {
        // SUCCESS: Reset all security tracking
        securityStore[email] = { failedAttempts: 0, lockoutCount: 0, lockUntil: null };
        
        return res.json({ 
            message: 'Login successful', 
            token: crypto.randomBytes(32).toString('hex') 
        });
    } else {
        // FAILURE: Increment failed attempts
        security.failedAttempts += 1;

        if (security.failedAttempts >= MAX_FAILED_ATTEMPTS) {
            // Trigger Lockout
            security.lockoutCount += 1;
            const duration = calculateLockoutDuration(security.lockoutCount);
            security.lockUntil = now + duration;
            
            // Reset failed attempts so they start from 0 after the lockout expires, 
            // but keep the lockoutCount for exponential back-off.
            security.failedAttempts = 0; 
        }

        return res.status(401).json({ error: GENERIC_ERROR });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});