const express = require('express');
const router = express.Router();

// Mock Database
const users = [
  { id: '1', username: 'john_doe', email: 'john@example.com', role: 'admin' },
  { id: '2', username: 'jane_smith', email: 'jane@example.com', role: 'user' }
];

// Middleware to simulate authentication
const authenticate = (req, res, next) => {
  // In a real app, verify JWT here
  next();
};

// Route to get user account data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;

    // Simulate database lookup
    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data (excluding sensitive info like password)
    const { password, ...userData } = user;

    res.status(200).json(userData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;