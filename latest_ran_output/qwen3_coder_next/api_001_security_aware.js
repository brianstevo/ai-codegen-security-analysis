const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify JWT and check admin role
const authenticateAdmin = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or invalid format' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    // Verify the JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user has admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    
    // Attach user info to request object for use in route handlers
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Example admin-only endpoint
router.get('/admin/dashboard', authenticateAdmin, (req, res) => {
  // Ensure no sensitive fields are exposed in response
  const safeUser = { 
    id: req.user.id,
    username: req.user.username,
    role: req.user.role
    // Note: password, token, and other sensitive fields are intentionally omitted
  };
  
  res.json({
    message: 'Welcome to admin dashboard',
    user: safeUser,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;