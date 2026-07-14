const crypto = require('crypto');

// In-memory store for tracking failed attempts and lock status
// Structure: { [userId]: { count: number, lastAttemptTime: Date, lockedUntil: Date | null } }
const loginAttemptsStore = {};

/**
 * Tracks failed login attempts and locks the account after too many failures.
 * 
 * @param {string} userId - The unique identifier of the user attempting to log in.
 * @param {number} maxAttempts - The maximum number of allowed failed attempts before locking (default: 5).
 * @param {number} lockDurationMs - The duration for which the account is locked in milliseconds (default: 15 minutes).
 * @returns {object} An object indicating whether the login was successful, if the account is locked, and remaining attempts.
 */
function trackFailedLogin(userId, maxAttempts = 5, lockDurationMs = 15 * 60 * 1000) {
    const now = Date.now();

    // Initialize user record if it doesn't exist
    if (!loginAttemptsStore[userId]) {
        loginAttemptsStore[userId] = {
            count: 0,
            lastAttemptTime: null,
            lockedUntil: null
        };
    }

    const userRecord = loginAttemptsStore[userId];

    // Check if the account is currently locked
    if (userRecord.lockedUntil && now < userRecord.lockedUntil) {
        return {
            success: false,
            locked: true,
            remainingAttempts: 0,
            message: 'Account is locked. Please try again later.'
        };
    }

    // If the lock duration has passed, reset the counter
    if (userRecord.lockedUntil && now >= userRecord.lockedUntil) {
        userRecord.count = 0;
        userRecord.lockedUntil = null;
    }

    // Increment failed attempt count
    userRecord.count += 1;
    userRecord.lastAttemptTime = new Date();

    // Check if max attempts reached
    if (userRecord.count >= maxAttempts) {
        userRecord.lockedUntil = now + lockDurationMs;
        return {
            success: false,
            locked: true,
            remainingAttempts: 0,
            message: 'Account locked due to too many failed attempts.'
        };
    }

    // Return failure with remaining attempts
    return {
        success: false,
        locked: false,
        remainingAttempts: maxAttempts - userRecord.count,
        message: `Login failed. ${maxAttempts - userRecord.count} attempts remaining.`
    };
}

/**
 * Resets the failed login counter for a successful login.
 * 
 * @param {string} userId - The unique identifier of the user who logged in successfully.
 */
function resetFailedLogin(userId) {
    if (loginAttemptsStore[userId]) {
        loginAttemptsStore[userId] = {
            count: 0,
            lastAttemptTime: null,
            lockedUntil: null
        };
    }
}

// Example usage in an Express route context
const express = require('express');
const app = express();
app.use(express.json());

// Mock user database
const users = {
    'user123': { password: 'hashedPasswordHere' } // In real app, use bcrypt.compare
};

app.post('/login', (req, res) => {
    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    // Check if user exists
    if (!users[userId]) {
        // Track failed attempt even for non-existent users to prevent enumeration
        const result = trackFailedLogin(userId);
        if (result.locked) {
            return res.status(423).json({ error: result.message });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password (mock verification)
    const isPasswordValid = password === 'correctPassword'; // Replace with bcrypt.compare in production

    if (!isPasswordValid) {
        const result = trackFailedLogin(userId);
        if (result.locked) {
            return res.status(423).json({ error: result.message });
        }
        return res.status(401).json({ error: result.message });
    }

    // Successful login
    resetFailedLogin(userId);
    res.json({ success: true, message: 'Login successful' });
});

module.exports = { trackFailedLogin, resetFailedLogin };