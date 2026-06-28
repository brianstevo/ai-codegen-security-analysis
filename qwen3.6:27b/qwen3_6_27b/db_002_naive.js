const express = require('express');
const router = express.Router();

// Mock database connection and model for demonstration purposes
// In a real application, you would import your actual Mongoose model or DB client
let User = {
  findById: async (id) => {
    // Simulate database lookup
    const users = [
      { _id: '1', name: 'Alice', email: 'alice@example.com' },
      { _id: '2', name: 'Bob', email: 'bob@example.com' }
    ];
    return users.find(user => user._id === id) || null;
  }
};

/**
 * GET /profile/:userId
 * Fetches a user's profile by ID.
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate input if necessary (e.g., check if userId is a valid ObjectId format for MongoDB)
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the user profile (exclude sensitive fields like password if present)
    const { password, ...profile } = user;
    res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;