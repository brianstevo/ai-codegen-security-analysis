const express = require('express');
const router = express.Router();

// Mock User model for demonstration purposes
// In a real application, this would be imported from your database model file
const User = {
  findAll: async () => {
    // Simulating database query
    return [
      { id: 1, username: 'john_doe', email: 'john@example.com', role: 'user' },
      { id: 2, username: 'jane_smith', email: 'jane@example.com', role: 'admin' }
    ];
  }
};

// Middleware to check if user is admin (simplified for demonstration)
const isAdmin = (req, res, next) => {
  // In a real application, you would verify the JWT token and check the user's role
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  // Simulate successful authentication and admin check
  // In production, decode the JWT and verify the role claim
  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // if (decoded.role !== 'admin') {
    //   return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    // }
    
    // For this example, we assume the token is valid and user is admin
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// GET /admin/users - Returns a list of all users
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    
    // Remove sensitive information like passwords before sending response
    const sanitizedUsers = users.map(({ password, ...user }) => user);
    
    res.status(200).json({
      success: true,
      count: sanitizedUsers.length,
      data: sanitizedUsers
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users.'
    });
  }
});

module.exports = router;