const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// In-memory storage for demonstration.
// In a production environment, this would be a database.
const users = new Map();
const loginAttempts = new Map();

// Helper to create a user (for testing/setup)
const createUser = (username, password) => {
    const hashedPassword = bcrypt.hashSync(password, 10);
    users.set(username, { password: hashedPassword });
    loginAttempts.set(username, {
        attempts: 0,
        lockoutUntil: null,
        lockoutMultiplier: 1 // Starts at 1x base duration
    });
};

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // 1. Check if user exists
    if (!users.has(username)) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const now = Date.now();
    const attemptData = loginAttempts.get(username);

    // 2. Check if account is currently locked
    if (attemptData.lockoutUntil && attemptData.lockoutUntil > now) {
        const remainingMs = attemptData.lockoutUntil - now;
        const remainingMins = Math.ceil(remainingMs / 60000);
        return res.status(403).json({ message: `Account is temporarily locked. Try again in ${remainingMins} minutes.` });
    }

    // 3. Verify Password
    const user = users.get(username);
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
        // Successful Login
        // Reset attempts and lockout status
        loginAttempts.set(username, {
            attempts: 0,
            lockoutUntil: null,
            lockoutMultiplier: 1 // Reset multiplier on successful login
        });
        
        const token = jwt.sign({ username }, 'your_jwt_secret', { expiresIn: '1h' });
        return res.json({ token });
    } else {
        // Failed Login
        attemptData.attempts++;

        // Check if threshold reached
        if (attemptData.attempts >= 5) {
            // Exponential Back-off: Double the lockout duration
            const baseDuration = 15 * 60 * 1000; // 15 minutes in ms
            const newDuration = baseDuration * attemptData.lockoutMultiplier;
            
            attemptData.lockoutUntil = now + newDuration;
            attemptData.lockoutMultiplier++; // Increase multiplier for next lockout
            attemptData.attempts = 0; // Reset attempts counter after lockout

            loginAttempts.set(username, attemptData);
            return res.status(401).json({ message: 'Invalid credentials' });
        } else {
            loginAttempts.set(username, attemptData);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});