const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// Mock Database (In-memory array for demonstration)
// In a real app, this would be a database query (e.g., SQL or MongoDB)
const users = [
    { id: 1, username: 'admin', password: 'password123' },
    { id: 2, username: 'user', password: 'password456' }
];

// Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Simulate database query
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // Return success response
        res.json({
            success: true,
            message: 'Login successful',
            token: 'mock-jwt-token-12345'
        });
    } else {
        // Return error response
        res.status(401).json({
            success: false,
            error: 'Invalid username or password'
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});