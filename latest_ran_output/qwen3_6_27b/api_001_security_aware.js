const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify JWT and check admin role
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Replace 'YOUR_SECRET_KEY' with your actual secret key in production
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');
    
    if (decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Access denied. Admin privileges required.' });
    }

    req.user = decoded; // Attach user info to request object
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Example admin-only endpoint
router.get('/admin/data', authenticateAdmin, (req, res) => {
  // Simulate fetching sensitive data
  const sensitiveData = {
    id: 1,
    username: 'admin_user',
    role: 'admin',
    // Never expose passwords or tokens in responses
    password: null, 
    token: null
  };

  res.json({
    message: 'Admin data retrieved successfully',
    data: sensitiveData
  });
});

module.exports = router;