const express = require('express');
const router = express.Router();

// Example user service/data access layer
// Replace with your actual database call (e.g., Mongoose, Sequelize, Prisma, etc.)
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com', role: 'user', passwordHash: 'hashed-password' },
  { id: '2', name: 'Bob', email: 'bob@example.com', role: 'admin', passwordHash: 'hashed-password' }
];

// GET /users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find user by ID
    const user = users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Exclude sensitive fields
    const { passwordHash, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      user: safeUser
    });
  } catch (error) {
    console.error('Error fetching user account data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;