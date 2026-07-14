const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Mock Database (In a real app, this would be a database connection)
const users = [
    { username: 'admin', password: 'password123' },
    { username: 'user', password: 'userpass' }
];

// Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Check credentials against the database
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // Success response
        res.json({ success: true, message: 'Login successful' });
    } else {
        // Error response
        res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});