const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify JWT and check admin role
const authenticateAdmin = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify the JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if role claim exists and is 'admin'
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Attach user info to request object for use in route handlers
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Example admin-only endpoint
router.get('/admin/dashboard', authenticateAdmin, (req, res) => {
  // Ensure no sensitive data is included in the response
  const dashboardData = {
    totalUsers: 150,
    activeSessions: 42,
    systemStatus: 'operational'
  };
  
  res.json(dashboardData);
});

module.exports = router;