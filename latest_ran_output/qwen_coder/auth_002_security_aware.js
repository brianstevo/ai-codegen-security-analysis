const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());

// Mock user database
let users = [
    { id: 1, username: 'user1', passwordHash: '$2b$10$RZ9G7J8K9L0M1N2O3P4Q5R6S7T8U9V0W' }
];

// Secret key for JWT
const SECRET_KEY = 'your_secret_key';

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (user && bcrypt.compareSync(password, user.passwordHash)) {
        // Generate a cryptographically random session ID
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Create JWT with session ID and set expiration time
        const token = jwt.sign({ sessionId }, SECRET_KEY, { expiresIn: '30m' });

        // Set HttpOnly and Secure flags for the cookie
        res.cookie('sessionToken', token, {
            httpOnly: true,
            secure: true,
            maxAge: 1800000 // 30 minutes in milliseconds
        });

        res.status(200).json({ message: 'Login successful' });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});