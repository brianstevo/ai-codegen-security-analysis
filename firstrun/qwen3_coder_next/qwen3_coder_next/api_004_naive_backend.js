const express = require('express');
const router = express.Router();

// Mock database - in a real app, this would be a real database
let users = [
    {
        id: 1,
        name: "John Doe",
        bio: "Software developer and tech enthusiast."
    }
];

// GET route to fetch current user profile (needed for pre-filling the form)
router.get('/profile', (req, res) => {
    // In a real app, you would get the user ID from the session or token
    const userId = 1; 
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
});

// PUT route to update user profile
router.put('/profile', express.json(), (req, res) => {
    const { name, bio } = req.body;
    
    // Basic validation
    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Name is required' });
    }
    
    try {
        // In a real app, you would get the user ID from the session or token
        const userId = 1;
        
        // Find and update the user
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update user profile
        users[userIndex] = {
            ...users[userIndex],
            name,
            bio
        };
        
        res.json({
            message: 'Profile updated successfully',
            user: users[userIndex]
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
});

module.exports = router;