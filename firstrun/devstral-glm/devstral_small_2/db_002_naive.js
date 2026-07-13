const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming you have a User model

// Route to fetch user profile by ID
router.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Exclude sensitive fields like password
        const { password, ...userProfile } = user.toObject();

        res.json(userProfile);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;