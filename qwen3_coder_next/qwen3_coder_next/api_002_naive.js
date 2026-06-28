const express = require('express');
const router = express.Router();

// Mock database - in production this would be replaced with actual database queries
const users = [
  {
    id: '1',
    username: 'johndoe',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: '2023-01-15T10:30:00Z'
  },
  {
    id: '2',
    username: 'janedoe',
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    createdAt: '2023-02-20T14:45:00Z'
  }
];

// GET /api/users/:id - Get user account data by ID
router.get('/:id', (req, res) => {
  const userId = req.params.id;
  
  // Find the user in our mock database
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ 
      error: 'User not found',
      message: `No user found with ID: ${userId}`
    });
  }
  
  // Return the user data (excluding sensitive information like passwords)
  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt
    }
  });
});

module.exports = router;