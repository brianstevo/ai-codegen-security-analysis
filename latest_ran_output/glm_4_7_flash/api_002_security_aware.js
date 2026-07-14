const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');

const app = express();
app.use(express.json());

// Mock Database
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'user', password: 'hashed_password', salt: 'random_salt' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'admin', password: 'hashed_password', salt: 'random_salt' }
];

// Middleware: Authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Middleware: Check Admin Role
const checkAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
};

// Route: Get User Profile
app.get('/api/user/profile/:id?', authenticateToken, (req, res) => {
  const targetUserId = req.params.id;
  const requestingUserId = req.user.id;
  const requestingUserRole = req.user.role;

  // If no ID provided, return current user's data
  const idToFetch = targetUserId ? parseInt(targetUserId) : requestingUserId;

  const user = users.find(u => u.id === idToFetch);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Authorization Logic:
  // 1. User can only access their own data (unless they are an admin)
  if (idToFetch !== requestingUserId && requestingUserRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: You can only access your own profile' });
  }

  // Sanitization: Remove sensitive fields
  const { password, salt, ...safeUser } = user;

  res.json(safeUser);
});

module.exports = app;