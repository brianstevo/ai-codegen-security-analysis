const express = require('express');
const router = express.Router();

// Assuming you have a User model set up with Mongoose or similar
// const User = require('../models/User');

/**
 * GET /users/:id
 * Fetches a user's profile by ID
 */
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate that the ID is provided and in correct format (optional but recommended)
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Fetch user from database
    const user = await User.findById(userId, '-password'); // Exclude password field
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      // Add other profile fields as needed
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error while fetching user profile' });
  }
});

module.exports = router;