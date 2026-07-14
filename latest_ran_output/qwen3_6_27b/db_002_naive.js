const express = require('express');
const router = express.Router();

// Mock database for demonstration purposes
const mockDatabase = {
  users: [
    { id: '1', username: 'john_doe', email: 'john@example.com' },
    { id: '2', username: 'jane_smith', email: 'jane@example.com' }
  ]
};

// Middleware to simulate database connection or validation if needed
const validateUserId = (req, res, next) => {
  const userId = req.params.id;
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  next();
};

// GET /profile/:id - Fetch user profile by ID
router.get('/profile/:id', validateUserId, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Simulate database query
    const user = mockDatabase.users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user profile (excluding sensitive data like password hashes in real scenarios)
    res.json({
      id: user.id,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;