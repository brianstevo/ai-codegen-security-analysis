// adminRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Replace with your actual User schema import
const User = require('../models/User');

// Middleware to verify JWT and attach user to request
const jwt = require('jsonwebtoken');
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token missing' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, ... }
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to ensure the user has admin privileges
const adminCheck = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * @route   GET /admin/users
 * @desc    Return a list of all users (admin only)
 * @access  Private (admin)
 */
router.get('/users', authMiddleware, adminCheck, async (req, res) => {
  try {
    // Exclude sensitive fields like password hashes
    const users = await User.find({})
      .select('-password -__v')
      .lean()
      .exec();

    return res.status(200).json({ count: users.length, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Server error while retrieving users' });
  }
});

module.exports = router;