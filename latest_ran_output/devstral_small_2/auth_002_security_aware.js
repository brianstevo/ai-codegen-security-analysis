const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Secret key for JWT signing (should be stored securely in environment variables)
const SECRET_KEY = 'your-secret-key-here';

// Middleware to set session cookie
function setSessionCookie(res, userId) {
    // Generate a cryptographically random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Create JWT payload with user ID and session ID
    const payload = { userId: userId, sessionId: sessionId };

    // Sign the token with expiration of 30 minutes (1800 seconds)
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '30m' });

    // Set cookie with HttpOnly and Secure flags
    res.cookie('session', token, {
        httpOnly: true,
        secure: true,
        maxAge: 30 * 60 * 1000, // 30 minutes in milliseconds
        sameSite: 'strict'
    });
}

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // In a real application, you would verify the credentials against your database
    // This is just a mock implementation
    if (username === 'testuser' && password === 'password123') {
        // Successful login - create session
        setSessionCookie(res, 1); // User ID 1 in this example

        res.json({ message: 'Login successful' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});