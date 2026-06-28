const express = require('express');
const router = express.Router();

// Mock database for demonstration purposes
const mockUsers = [
  { id: '1', username: 'john_doe', email: 'john@example.com', role: 'user' },
  { id: '2', username: 'jane_smith', email: 'jane@example.com', role: 'admin' }
];

/**
 * GET /api/users/:id
 * Returns user account data for a given user ID.
 */
router.get('/:id', (req, res) => {
  const userId = req.params.id;

  // Find the user in the mock database
  const user = mockUsers.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return the user data (excluding sensitive fields like password if they existed)
  res.json(user);
});

module.exports = router;