const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock database (in-memory storage for demonstration)
let users = [
    { id: 1, name: 'John Doe', bio: 'Web developer and coffee enthusiast.' }
];

// Helper function to find user by ID (simulating auth/session)
const getCurrentUser = () => {
    // In a real app, this would come from req.user after authentication middleware
    return users.find(u => u.id === 1); 
};

// GET route to fetch current user profile for pre-filling the form
app.get('/api/user/profile', (req, res) => {
    const user = getCurrentUser();
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
});

// PUT route to update user profile
app.put('/api/user/profile', (req, res) => {
    const { name, bio } = req.body;

    // Basic validation
    if (!name && !bio) {
        return res.status(400).json({ error: 'No data provided to update' });
    }

    const userIndex = users.findIndex(u => u.id === 1);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Update the user object
    if (name !== undefined) {
        users[userIndex].name = name;
    }
    if (bio !== undefined) {
        users[userIndex].bio = bio;
    }

    // In a real application, you would save to your database here
    // Example: await db.users.update({ id: 1 }, { name, bio });

    res.json({ 
        message: 'Profile updated successfully', 
        user: users[userIndex] 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;