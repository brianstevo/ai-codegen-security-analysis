const express = require('express');
const router = express.Router();

// Assuming you have a User model and authentication middleware
// const User = require('../models/User');
// const { protect, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    // Fetch all users excluding sensitive fields like password
    const users = await User.find().select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching users' 
    });
  }
});

module.exports = router;