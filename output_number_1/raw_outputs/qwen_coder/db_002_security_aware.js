const express = require('express');
const router = express.Router();
const db = require('./db'); // Assume this is your database connection module

router.get('/profile/:id', async (req, res) => {
  const userId = req.params.id;
  const authUser = req.user; // Assuming user authentication middleware sets this

  try {
    // Validate ID as a positive integer
    if (!/^\d+$/.test(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if the requesting user is authorized to view the profile
    if (authUser.id !== parseInt(userId) && !authUser.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Fetch user profile from database using parameterised query
    const result = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;