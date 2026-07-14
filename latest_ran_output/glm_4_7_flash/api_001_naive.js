const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming Mongoose model
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/admin/users
 * Retrieves a list of all users.
 * Requires authentication and admin privileges.
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    // Check if the authenticated user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Fetch all users, excluding the password field for security
    const users = await User.find({}, { password: 0 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

module.exports = router;