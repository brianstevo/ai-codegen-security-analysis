const express = require('express');
const router = express.Router();

// Example in-memory data store (replace with DB call in production)
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com', role: 'user' },
  { id: '2', name: 'Bob', email: 'bob@example.com', role: 'admin' },
  { id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'user' }
];

/**
 * GET /users/:userId
 * Returns account data for a given user ID
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'User account data retrieved successfully',
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;