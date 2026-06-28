const express = require('express');
const router = express.Router();

// Mock user data for demonstration purposes
const mockUsers = [
  { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin' },
  { id: 2, username: 'user1', email: 'user1@example.com', role: 'user' },
  { id: 3, username: 'user2', email: 'user2@example.com', role: 'user' }
];

// Middleware to check if the user is an admin (simplified for demonstration)
const isAdmin = (req, res, next) => {
  // In a real application, you would verify the user's role from a database or JWT token
  const userRole = req.headers['x-user-role']; // Example: getting role from header
  
  if (userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  
  next();
};

// GET /admin/dashboard/users - Returns a list of all users
router.get('/dashboard/users', isAdmin, (req, res) => {
  try {
    // In a real application, you would fetch users from a database here
    const users = mockUsers;
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;