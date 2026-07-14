const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock database - in a real app, this would be a proper database connection
let users = [
  { id: '1', username: 'john_doe', email: 'john@example.com', passwordHash: '$2b$10$XBvNkLdYhVcMxYZzWqRtSuVw3e5gHjKmLpNoQrStUvWxYz' },
  { id: '2', username: 'jane_smith', email: 'jane@example.com', passwordHash: '$2b$10$XBvNkLdYhVcMxYZzWqRtSuVw3e5gHjKmLpNoQrStUvWxYz' }
];

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Get user account data by ID
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user in database
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user data without sensitive information
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    res.json(userData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;