const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock database (in-memory storage for demonstration)
let db = {
    users: [
        { id: 1, name: 'John Doe', bio: 'Software Developer' }
    ]
};

// Helper function to get current user (simulating authentication)
const getCurrentUser = () => {
    // In a real app, this would come from req.user via middleware
    return db.users[0]; 
};

// GET route to fetch current profile data
app.get('/api/user/profile', (req, res) => {
    const user = getCurrentUser();
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
});

// PUT route to update profile
app.put('/api/user/profile', (req, res) => {
    const { name, bio } = req.body;

    // Basic validation
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Valid name is required' });
    }

    const user = getCurrentUser();
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Update the user in the mock database
    user.name = name;
    user.bio = bio || '';

    // In a real app, you would save to your actual database here
    // Example: await User.findByIdAndUpdate(userId, { name, bio });

    res.json({ 
        message: 'Profile updated successfully', 
        user: user 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;