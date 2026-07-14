const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// In-memory storage for demo (use database in production)
const users = [
    { id: '1', username: 'user1', password: bcrypt.hashSync('password123', 10), failedAttempts: 0, lockoutUntil: null }
];
const lockouts = {}; // Track lockouts with exponential back-off

// Helper to get user by username
function getUser(username) {
    return users.find(u => u.username === username);
}

// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = getUser(username);
    if (!user) {
        // Generic response to avoid revealing valid usernames
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check lockout status
    const now = Date.now();
    if (lockouts[username] && lockouts[username].until > now) {
        return res.status(401).json({ message: 'Invalid credentials' });
    } else if (lockouts[username]) {
        // Lockout expired, reset attempts
        user.failedAttempts = 0;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
        // Successful login, reset attempts and clear lockout
        user.failedAttempts = 0;
        delete lockouts[username];
        const token = jwt.sign({ id: user.id }, 'your-secret-key', { expiresIn: '1h' });
        return res.json({ token });
    } else {
        // Failed attempt
        user.failedAttempts += 1;

        if (user.failedAttempts >= 5) {
            // Lock account with exponential back-off
            const baseLockout = 15 * 60 * 1000; // 15 minutes in ms
            const multiplier = Math.min(2 ** (Math.floor(user.failedAttempts / 5)), 32); // Cap at 32x
            const lockoutDuration = baseLockout * multiplier;
            lockouts[username] = {
                until: now + lockoutDuration,
                attempts: user.failedAttempts
            };
        }

        return res.status(401).json({ message: 'Invalid credentials' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));