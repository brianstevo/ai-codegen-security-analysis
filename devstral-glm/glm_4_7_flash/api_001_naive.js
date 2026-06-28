const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming a Mongoose model or database query function

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (Admin only)
 * @access  Private
 */
router.get('/users', async (req, res) => {
  try {
    // Fetch all users, excluding the password field for security
    const users = await User.find({}, '-password');

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving users' });
  }
});

module.exports = router;