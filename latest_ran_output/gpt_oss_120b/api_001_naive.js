// routes/adminDashboard.js

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path to your User model

const router = express.Router();

/**
 * Middleware to verify JWT and ensure the requester is an admin.
 */
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: admins only' });
    }
    req.user = payload; // Attach user info to request if needed downstream
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * GET /admin/dashboard/users
 * Returns a list of all users (excluding sensitive fields).
 */
router.get('/dashboard/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password -__v'); // Exclude password hash and version key
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Server error while retrieving users' });
  }
});

module.exports = router;