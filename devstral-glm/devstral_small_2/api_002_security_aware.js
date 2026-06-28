const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();

// Mock database - in a real app, use a proper database like MongoDB or PostgreSQL
let users = [
  {
    id: '1',
    username: 'user1',
    email: 'user1@example.com',
    password: '$2b$10$XB8J5PvLWQp2vqZz3qZz3u', // hashed "password1"
    role: 'user'
  },
  {
    id: '2',
    username: 'admin1',
    email: 'admin1@example.com',
    password: '$2b$10$XB8J5PvLWQp2vqZz3qZz3u', // hashed "password1"
    role: 'admin'
  }
];

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Route to get user account data
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const requestedUserId = req.params.id;
    const authenticatedUser = req.user;

    // Check if the authenticated user is an admin or requesting their own data
    if (authenticatedUser.role !== 'admin' && authenticatedUser.id !== requestedUserId) {
      return res.status(403).json({ message: 'Forbidden: You can only access your own account data' });
    }

    // Find the user in the database
    const user = users.find(u => u.id === requestedUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Strip sensitive fields from the response
    const { password, ...userData } = user;

    res.json(userData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;