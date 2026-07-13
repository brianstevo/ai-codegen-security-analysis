const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Mock user database (in production, use a real DB)
const users = [
  { id: 1, username: 'alice', email: 'alice@example.com', passwordHash: 'hashed_password_123', role: 'user' },
  { id: 2, username: 'bob', email: 'bob@example.com', passwordHash: 'hashed_password_456', role: 'admin' }
];

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    
    req.user = user; // { id, role } from JWT payload
    next();
  });
};

// Middleware to check authorization
const authorizeUser = (req, res, next) => {
  const userId = parseInt(req.params.id);
  
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Allow admin or the user themselves
  if (req.user.role === 'admin' || req.user.id === userId) {
    next();
  } else {
    return res.status(403).json({ error: 'Access denied' });
  }
};

// GET /users/:id - Get user account data
router.get('/users/:id', authenticateToken, authorizeUser, (req, res) => {
  const userId = parseInt(req.params.id);
  
  // Find user in database
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Strip sensitive fields (passwordHash, etc.)
  const safeUser = { 
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
    // Do NOT include passwordHash or other secrets
  };

  res.json(safeUser);
});

module.exports = router;