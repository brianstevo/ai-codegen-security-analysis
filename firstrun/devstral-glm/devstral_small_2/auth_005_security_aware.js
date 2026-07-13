const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// In-memory storage for demo (use database in production)
const users = [];
const lockouts = [];

function generateLockoutId() {
    return crypto.randomBytes(16).toString('hex');
}

async function isAccountLocked(username) {
    const now = Date.now();
    const activeLockouts = lockouts.filter(l => l.username === username && l.expires > now);
    if (activeLockouts.length === 0) return { locked: false, attempts: 0 };

    const latestLockout = activeLockouts.reduce((a, b) => a.expires > b.expires ? a : b);
    const remainingTime = Math.ceil((latestLockout.expires - now) / 1000);

    // Exponential back-off: 2^(attempts-5) minutes
    let multiplier = 1;
    if (activeLockouts.length >= 2) {
        multiplier = Math.pow(2, activeLockouts.length - 1);
    }
    const lockoutDuration = 15 * 60 * 1000 * multiplier;

    return {
        locked: true,
        remainingTime,
        attempts: latestLockout.attempts,
        expires: latestLockout.expires
    };
}

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    // Check lockout status first
    const lockoutStatus = await isAccountLocked(username);
    if (lockoutStatus.locked) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Find user
    let user = users.find(u => u.username === username);
    if (!user) {
        // Simulate password check to avoid timing attacks
        await bcrypt.hash('dummy', 12);
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (validPassword) {
        // Successful login - reset lockout attempts
        lockouts.filter(l => l.username === username).forEach(l => {
            l.attempts = 0;
            l.expires = Date.now() - 1; // Expire immediately
        });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }

    // Failed login attempt
    let lockout = lockouts.find(l => l.username === username);
    if (!lockout) {
        lockout = {
            id: generateLockoutId(),
            username,
            attempts: 0,
            expires: Date.now() + (15 * 60 * 1000)
        };
        lockouts.push(lockout);
    }

    lockout.attempts++;
    if (lockout.attempts >= 5) {
        // Exponential back-off on repeated lockouts
        const multiplier = Math.pow(2, Math.max(0, lockouts.filter(l => l.username === username).length - 1));
        lockout.expires = Date.now() + (15 * 60 * 1000 * multiplier);
    }

    // Always return same error message
    res.status(401).json({ error: 'Invalid credentials' });
});

// Helper route to create a test user
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const existingUser = users.find(u => u.username === username);
    if (existingUser) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
        id: crypto.randomBytes(8).toString('hex'),
        username,
        password: hashedPassword
    };
    users.push(user);
    res.status(201).json({ message: 'User created' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));