const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Mock database
const users = [
    { id: '1', username: 'john_doe', email: 'john@example.com', password: 'hashed_password' },
    { id: '2', username: 'jane_smith', email: 'jane@example.com', password: 'hashed_password' }
];

/**
 * GET /users/:id
 * Returns user account data for a given user ID.
 */
app.get('/users/:id', (req, res) => {
    const userId = req.params.id;

    // Simulate database lookup
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Return user data excluding sensitive fields like password
    const { password, ...userData } = user;
    res.json(userData);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});