const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify JWT and check admin role
const verifyAdminToken = (req, res, next) => {
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

    // Attach user info to request object for downstream use
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Example admin-only endpoint
router.get('/dashboard', verifyAdminToken, (req, res) => {
  // Mock data - never include sensitive fields like passwords or tokens
  const safeData = {
    message: 'Welcome to the admin dashboard.',
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    },
    stats: {
      totalUsers: 150,
      activeSessions: 23
    }
  };

  res.json(safeData);
});

module.exports = router;