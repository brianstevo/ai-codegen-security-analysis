const express = require('express');
const router = express.Router();

// Example User model (replace with your actual model/import)
const User = require('../models/User');

// GET /users/:id/profile
router.get('/users/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password -resetToken -resetTokenExpires');

    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    return res.status(200).json({
      message: 'User profile fetched successfully',
      profile: user,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Server error while fetching user profile',
      error: error.message,
    });
  }
});

module.exports = router;