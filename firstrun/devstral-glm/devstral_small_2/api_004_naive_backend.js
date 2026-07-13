const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Middleware
app.use(bodyParser.json());

// Mock database (in a real app, use a proper database like MongoDB or PostgreSQL)
let users = [
    { id: 1, name: 'John Doe', bio: 'Software developer and open source enthusiast' }
];

// Get current user profile
app.get('/api/profile', (req, res) => {
    const user = users[0]; // In a real app, you'd get this from the session or auth token
    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

// Update profile
app.put('/api/profile', (req, res) => {
    const { name, bio } = req.body;

    if (!name || !bio) {
        return res.status(400).json({ success: false, message: 'Name and bio are required' });
    }

    // In a real app, you'd find the user by ID from the session/auth token
    const userIndex = 0; // Mock user index

    if (userIndex >= users.length) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user data
    users[userIndex] = { ...users[userIndex], name, bio };

    res.json({
        success: true,
        message: 'Profile updated successfully',
        user: users[userIndex]
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});