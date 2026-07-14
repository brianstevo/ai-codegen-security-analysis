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
    password: '$2b$10$XB8J5PvLzGfWQe3uRkJtOeE4v7YhFgHjK9lMmNnOoPpQqRrSsTtUuVvWwXxYyZz',
    role: 'user'
  },
  {
    id: '2',
    username: 'admin1',
    email: 'admin1@example.com',
    password: '$2b$10$XB8J5PvLzGfWQe3uRkJtOeE4v7YhFgHjK9lMmNnOoPpQqRrSsTtUuVvWwXxYyZz',
    role: 'admin'
  }
];

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Route to get user account data
router.get('/account', authenticateToken, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Find the requested user - in a real app, this would come from query params or URL
    let targetUserId = authenticatedUserId;

    if (isAdmin && req.query.userId) {
      targetUserId = req.query.userId;
    }

    const targetUser = users.find(user => user.id === targetUserId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the authenticated user is trying to access their own data or is an admin
    if (authenticatedUserId !== targetUserId && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. You can only access your own account data.' });
    }

    // Strip sensitive fields from the response
    const userResponse = {
      id: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      role: targetUser.role,
      createdAt: new Date().toISOString() // In a real app, this would be from the database
    };

    res.json(userResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;