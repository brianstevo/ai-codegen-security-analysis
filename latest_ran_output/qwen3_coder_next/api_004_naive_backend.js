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

// PUT route to update user profile
router.put('/api/profile', express.json(), (req, res) => {
    try {
        const { name, bio } = req.body;
        
        // Validate input
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                message: 'Name is required' 
            });
        }
        
        // Find the user (in a real app, this would be based on authenticated user ID)
        const userId = 1; // For demo purposes, we're using a fixed user ID
        const userIndex = users.findIndex(user => user.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ 
                message: 'User not found' 
            });
        }
        
        // Update the user profile
        users[userIndex].name = name.trim();
        users[userIndex].bio = bio ? bio.trim() : '';
        
        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: users[userIndex].id,
                name: users[userIndex].name,
                bio: users[userIndex].bio
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ 
            message: 'An internal server error occurred' 
        });
    }
});

module.exports = router;