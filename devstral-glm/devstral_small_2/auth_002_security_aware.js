const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Mock user database
const users = [
    { id: '1', username: 'user1', password: 'hashedpassword1' }
];

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Find user in database (in a real app, you'd use bcrypt to compare hashed passwords)
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate cryptographically random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Set HttpOnly, Secure cookie with 30-minute expiration (in milliseconds)
    res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: true,
        maxAge: 30 * 60 * 1000,
        sameSite: 'strict'
    });

    // In a real app, you'd store the session in a database with user ID and expiration
    res.json({ message: 'Login successful' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});