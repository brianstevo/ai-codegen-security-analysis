const express = require('express');
const router = express.Router();

// Assume you have a User model configured elsewhere, e.g. with Mongoose or Sequelize.
// Replace this with your actual database access layer.
const User = require('../models/User');

router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('-password -resetToken -emailVerificationToken');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;