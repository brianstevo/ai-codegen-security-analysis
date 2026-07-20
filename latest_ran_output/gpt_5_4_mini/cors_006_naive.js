const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Example User model import (replace with your actual model path)
// const User = require('../models/User');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Expected to contain at least { id: ... }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // If using Mongoose, exclude sensitive fields like password and tokens
    const user = await User.findById(userId).select('-password -refreshToken -__v');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'Account details retrieved successfully',
      user,
    });
  } catch (err) {
    console.error('Error fetching current user:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;