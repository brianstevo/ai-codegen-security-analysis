// routes/profile.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Assuming a Mongoose User model exists in ../models/User
const User = require('../models/User');

/**
 * GET /users/:id
 * Fetches a user's profile by their ID.
 */
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID format.' });
  }

  try {
    // Exclude sensitive fields like password, __v, etc.
    const user = await User.findById(id)
      .select('-password -__v')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ profile: user });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;