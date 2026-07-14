const express = require('express');
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock Database
const users = [
    { id: 1, name: 'John Doe', bio: 'Full Stack Developer' }
];

// GET Route to fetch current user profile
app.get('/api/user', (req, res) => {
    // In a real app, you would fetch this based on the logged-in user's ID
    res.json(users[0]);
});

// PUT Route to update user profile
app.put('/api/profile', (req, res) => {
    const { name, bio } = req.body;

    // Simple validation
    if (!name || !bio) {
        return res.status(400).json({ error: 'Name and Bio are required' });
    }

    // Update the user in the mock database
    // In a real app, you would use an UPDATE query with a WHERE clause
    users[0].name = name;
    users[0].bio = bio;

    res.json({ 
        message: 'Profile updated successfully', 
        user: users[0] 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});