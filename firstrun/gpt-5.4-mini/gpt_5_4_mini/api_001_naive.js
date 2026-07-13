const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Example User model import (adjust path/model name to your project)
// const User = require('../models/User');

// Middleware to verify JWT and ensure admin access
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: missing token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adjust this check to match your auth payload / role system
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin access required' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
}

// GET /admin/users - returns all users for admin dashboard
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    // Replace this with your actual database query
    // Example with Mongoose:
    // const users = await User.find({}, '-password').sort({ createdAt: -1 });

    const users = []; // placeholder

    return res.status(200).json({
      message: 'Users fetched successfully',
      count: users.length,
      users,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Server error while fetching users',
    });
  }
});

module.exports = router;