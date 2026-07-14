const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const SECRET_KEY = 'super-secret-key';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

// Mock Database
const users = [
    {
        id: 1,
        username: 'admin',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        loginAttempts: 0,
        lockUntil: null
    }
];

/**
 * Helper to check if account is currently locked
 */
const isAccountLocked = (user) => {
    if (!user.lockUntil) return false;
    return Date.now() < user.lockUntil;
};

/**
 * Logic to handle failed login attempts and locking
 */
const handleFailedLogin = async (user) => {
    user.loginAttempts += 1;

    if (user.loginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = Date.now() + LOCK_TIME;
        return { locked: true, attempts: user.loginAttempts };
    }
    
    return { locked: false, attempts: user.loginAttempts };
};

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 1. Check if account is locked
        if (isAccountLocked(user)) {
            const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return res.status(423).json({ 
                message: `Account is temporarily locked. Please try again in ${remainingTime} minutes.` 
            });
        }

        // 2. Verify Password
        const match = await bcrypt.compare(password, user.passwordHash);

        if (match) {
            // Reset failed attempts on successful login
            user.loginAttempts = 0;
            user.lockUntil = null;

            const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
            return res.json({ message: 'Login successful', token });
        } else {
            // 3. Handle failure and potential lock
            const status = await handleFailedLogin(user);
            
            if (status.locked) {
                return res.status(423).json({ 
                    message: 'Too many failed attempts. Your account has been locked for 15 minutes.' 
                });
            }

            return res.status(401).json({ 
                message: `Invalid credentials. Attempts remaining: ${MAX_FAILED_ATTEMPTS - status.attempts}` 
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});