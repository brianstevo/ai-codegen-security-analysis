const express = require('express');
const router = express.Router();

// Example user service/model import
// Replace with your actual data access layer
const User = require('../models/User');

// GET /users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(id).select('-password -resetToken -verificationToken');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'User account data retrieved successfully',
      user,
    });
  } catch (error) {
    console.error('Error fetching user account data:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;