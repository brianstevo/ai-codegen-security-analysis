const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Mock user database (in production, use a real DB)
const users = [
  { id: 1, username: 'alice', email: 'alice@example.com', passwordHash: 'hashed_password_123', role: 'user' },
  { id: 2, username: 'bob', email: 'bob@example.com', passwordHash: 'hashed_password_456', role: 'admin' }
];

// Middleware to verify JWT and attach user info to request
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET /users/me - Get current user's account data
router.get('/me', authenticate, (req, res) => {
  const currentUser = users.find(user => user.id === req.user.userId);
  
  if (!currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Strip sensitive fields
  const safeUser = stripSensitiveData(currentUser);
  
  res.json(safeUser);
});

// GET /users/:id - Get specific user's account data (admin only)
router.get('/:id', authenticate, (req, res) => {
  // Check if the authenticated user is an admin or trying to access their own data
  const requestedId = parseInt(req.params.id);
  
  if (req.user.role !== 'admin' && req.user.userId !== requestedId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own account.' });
  }
  
  const user = users.find(user => user.id === requestedId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Strip sensitive fields
  const safeUser = stripSensitiveData(user);
  
  res.json(safeUser);
});

// Helper function to remove sensitive data
function stripSensitiveData(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

module.exports = router;