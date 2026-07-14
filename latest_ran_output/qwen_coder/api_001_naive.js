const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming you have a User model

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Access denied' });
}

// Route to get all users
router.get('/dashboard/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;