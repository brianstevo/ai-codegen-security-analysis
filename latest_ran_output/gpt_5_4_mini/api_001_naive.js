const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Mock database access layer (replace with your real DB model/query)
const User = {
  findAll: async () => [
    { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' },
    { id: 2, name: 'User One', email: 'user1@example.com', role: 'user' },
  ],
};

// Middleware to verify JWT and attach user to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: missing token' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'your_jwt_secret';
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
}

// Middleware to ensure user is admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin access required' });
  }
  next();
}

// Admin dashboard endpoint: list all users
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll();

    return res.status(200).json({
      message: 'Users retrieved successfully',
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});

module.exports = router;