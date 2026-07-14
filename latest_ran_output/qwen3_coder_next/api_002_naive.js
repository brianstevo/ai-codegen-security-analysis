const express = require('express');
const router = express.Router();

// Mock database - in production this would be replaced with actual database queries
const users = [
  { id: '1', name: 'John Doe', email: 'john@example.com', createdAt: '2023-01-15T10:30:00Z' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', createdAt: '2023-02-20T14:45:00Z' }
];

// Route to get user account data by ID
router.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  
  // Find the user in our mock database
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Return user account data (excluding sensitive information like passwords)
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  });
});

module.exports = router;