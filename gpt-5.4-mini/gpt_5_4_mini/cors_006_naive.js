const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Example User model import (adjust path/model name to your project)
// const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware to authenticate and attach user info to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // expected to contain at least { id, email, ... }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
}

// GET /api/account/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({ message: 'Invalid token payload' });
    }

    // Replace this with your actual database lookup
    // Example with Mongoose:
    // const user = await User.findById(userId).select('-password -resetToken -verificationToken');

    // Mock response if no DB is wired up yet:
    const user = {
      id: userId,
      email: req.user.email || 'user@example.com',
      name: req.user.name || 'John Doe',
      createdAt: req.user.createdAt || new Date().toISOString(),
    };

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      message: 'Account details retrieved successfully',
      user,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;