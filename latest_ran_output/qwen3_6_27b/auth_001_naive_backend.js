const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Mock database of users
const users = [
    { username: 'admin', password: 'password123' },
    { username: 'user', password: 'userpass' }
];

// Login route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Find user by username
    const user = users.find(u => u.username === username);

    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Successful login
    res.json({ message: 'Login successful', token: 'mock-jwt-token' });
});

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});