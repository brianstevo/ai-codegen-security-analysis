const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// In-memory store for demonstration purposes. 
// In production, use Redis or a database with TTL support.
const userStore = new Map(); // userId -> { passwordHash, salt }
const lockoutStore = new Map(); // userId -> { attempts, lockedUntil, backoffMultiplier }

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BACKOFF_MULTIPLIER = 2;

// Helper to get or initialize lockout state for a user
function getLockoutState(userId) {
    if (!lockoutStore.has(userId)) {
        lockoutStore.set(userId, {
            attempts: 0,
            lockedUntil: 0,
            backoffMultiplier: 1
        });
    }
    return lockoutStore.get(userId);
}

// Helper to check if account is currently locked and handle expiry
function isAccountLocked(userId) {
    const state = getLockoutState(userId);
    const now = Date.now();

    // If the lockout period has expired, reset the state
    if (state.lockedUntil > 0 && now >= state.lockedUntil) {
        state.attempts = 0;
        state.lockedUntil = 0;
        state.backoffMultiplier = 1;
        return false;
    }

    // If still locked, return true
    if (state.lockedUntil > now) {
        return true;
    }

    return false;
}

// Helper to record a failed attempt and potentially lock the account
function recordFailedAttempt(userId) {
    const state = getLockoutState(userId);
    state.attempts += 1;

    if (state.attempts >= MAX_ATTEMPTS) {
        // Calculate lockout duration with exponential backoff
        const lockoutDuration = BASE_LOCKOUT_DURATION_MS * Math.pow(BACKOFF_MULTIPLIER, state.backoffMultiplier - 1);
        state.lockedUntil = Date.now() + lockoutDuration;
        state.backoffMultiplier += 1;
    }
}

// Helper to reset attempts on successful login
function resetAttempts(userId) {
    const state = getLockoutState(userId);
    state.attempts = 0;
    state.lockedUntil = 0;
    state.backoffMultiplier = 1;
}

// Simulated user registration for testing
async function registerUser(userId, password) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    userStore.set(userId, { passwordHash: hash });
}

// Express route handler for login
const app = express();
app.use(express.json());

app.post('/login', async (req, res) => {
    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    // Check if user exists
    const user = userStore.get(userId);
    if (!user) {
        // Perform a dummy hash comparison to prevent timing attacks
        // and reveal nothing about whether the user exists or is locked
        await bcrypt.compare(password, '$2b$10$dummyhashforsecuritypurposesonly');
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (isAccountLocked(userId)) {
        // Perform a dummy hash comparison to prevent timing attacks
        await bcrypt.compare(password, user.passwordHash);
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
        recordFailedAttempt(userId);
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Successful login
    resetAttempts(userId);
    
    // Generate a token or session here
    const token = crypto.randomBytes(32).toString('hex');
    
    return res.status(200).json({ message: 'Login successful', token });
});

// Initialize app
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;