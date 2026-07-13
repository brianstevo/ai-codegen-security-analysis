const express = require('express');
const router = express.Router();

// Middleware to verify JWT token and attach user to request
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Mock User model for demonstration purposes
const User = {
  findById: async (id) => {
    // In a real application, this would query a database
    const mockUser = {
      id: id,
      username: 'johndoe',
      email: 'john.doe@example.com',
      createdAt: new Date().toISOString()
    };
    return mockUser;
  }
};

const jwt = require('jsonwebtoken');

// Route to get current user's account details
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user details excluding sensitive information like password hash
    const { password, ...userDetails } = user;
    res.json(userDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;