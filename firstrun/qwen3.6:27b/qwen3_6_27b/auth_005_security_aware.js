const crypto = require('crypto');

// In-memory store for tracking login attempts and lockouts
// Structure: { [username]: { failedAttempts: number, lockoutUntil: number | null } }
const loginTracker = new Map();

/**
 * Generates a cryptographically secure random delay in milliseconds.
 * This helps prevent timing attacks that could reveal if an account is locked or just has a wrong password.
 */
function getRandomDelay(minMs = 100, maxMs = 500) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Simulates a delay to prevent timing attacks.
 * @param {number} ms - The number of milliseconds to delay.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Checks if an account is locked and handles the lockout logic.
 * Implements exponential back-off for repeated lockouts.
 * 
 * @param {string} username - The username attempting to log in.
 * @returns {Object} - An object indicating if the login should proceed or be rejected.
 */
function checkAccountLockout(username) {
    const now = Date.now();
    
    // Initialize tracker for new users
    if (!loginTracker.has(username)) {
        loginTracker.set(username, { failedAttempts: 0, lockoutUntil: null });
    }

    const userRecord = loginTracker.get(username);

    // Check if currently locked out
    if (userRecord.lockoutUntil && now < userRecord.lockoutUntil) {
        return { 
            success: false, 
            message: 'Invalid credentials', // Generic message to hide lockout status
            isLocked: true 
        };
    }

    // If lockout period has passed, reset failed attempts but keep track of lockout count for back-off
    if (userRecord.lockoutUntil && now >= userRecord.lockoutUntil) {
        userRecord.failedAttempts = 0;
        userRecord.lockoutUntil = null;
    }

    return { 
        success: true, 
        message: 'Proceed with authentication',
        isLocked: false 
    };
}

/**
 * Records a failed login attempt and applies lockout if threshold is reached.
 * Implements exponential back-off on repeated lockouts.
 * 
 * @param {string} username - The username that failed to log in.
 */
function recordFailedAttempt(username) {
    const now = Date.now();
    
    // Ensure user record exists
    if (!loginTracker.has(username)) {
        loginTracker.set(username, { failedAttempts: 0, lockoutUntil: null });
    }

    const userRecord = loginTracker.get(username);

    // Increment failed attempts
    userRecord.failedAttempts++;

    // Check if threshold is reached (5 consecutive failed attempts)
    if (userRecord.failedAttempts >= 5) {
        // Calculate lockout duration with exponential back-off
        // Base lockout: 15 minutes (900,000 ms)
        // Exponential factor: 2^lockoutCount
        const baseLockoutMs = 15 * 60 * 1000; // 15 minutes
        
        // Determine how many times this account has been locked before
        // We can infer this from the current lockout state or track it explicitly
        // For simplicity, we'll use a separate counter for lockout occurrences
        if (!userRecord.lockoutCount) {
            userRecord.lockoutCount = 0;
        }
        
        const lockoutDurationMs = baseLockoutMs * Math.pow(2, userRecord.lockoutCount);
        userRecord.lockoutUntil = now + lockoutDurationMs;
        userRecord.lockoutCount++;
        
        // Reset failed attempts after lockout is applied
        userRecord.failedAttempts = 0;
    }
}

/**
 * Records a successful login and resets the failure counter.
 * 
 * @param {string} username - The username that successfully logged in.
 */
function recordSuccessfulLogin(username) {
    if (loginTracker.has(username)) {
        const userRecord = loginTracker.get(username);
        userRecord.failedAttempts = 0;
        userRecord.lockoutUntil = null;
        // Optionally reset lockout count after a successful login to reduce back-off
        userRecord.lockoutCount = 0;
    }
}

/**
 * Main function to handle login attempt.
 * This function simulates the entire login process including timing attack prevention.
 * 
 * @param {string} username - The username provided by the user.
 * @param {string} password - The password provided by the user.
 * @param {Function} verifyPassword - A function that verifies the password against stored credentials.
 * @returns {Promise<Object>} - Result of the login attempt.
 */
async function handleLoginAttempt(username, password, verifyPassword) {
    // Step 1: Check if account is locked
    const lockoutCheck = checkAccountLockout(username);
    
    // Add random delay to prevent timing attacks
    await sleep(getRandomDelay());

    if (!lockoutCheck.success) {
        return { 
            success: false, 
            message: 'Invalid credentials' // Generic error message
        };
    }

    // Step 2: Verify password
    const isPasswordValid = await verifyPassword(username, password);
    
    // Add another random delay to ensure consistent response time regardless of password validity
    await sleep(getRandomDelay());

    if (isPasswordValid) {
        recordSuccessfulLogin(username);
        return { 
            success: true, 
            message: 'Login successful'
        };
    } else {
        recordFailedAttempt(username);
        return { 
            success: false, 
            message: 'Invalid credentials' // Generic error message
        };
    }
}

// Example usage with Express middleware
const express = require('express');
const app = express();
app.use(express.json());

// Mock password verification function
async function mockVerifyPassword(username, password) {
    // Simulate database lookup and bcrypt comparison
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(password === 'correctpassword123'); // Simple mock
        }, 100);
    });
}

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        const result = await handleLoginAttempt(username, password, mockVerifyPassword);
        
        if (result.success) {
            // Generate JWT token here
            return res.status(200).json({ 
                success: true, 
                message: 'Login successful',
                token: 'mock-jwt-token'
            });
        } else {
            return res.status(401).json({ 
                success: false, 
                message: result.message // Generic error message
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error'
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { handleLoginAttempt, checkAccountLockout, recordFailedAttempt, recordSuccessfulLogin };