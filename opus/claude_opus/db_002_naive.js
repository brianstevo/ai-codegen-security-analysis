const express = require('express');
const router = express.Router();

// Assumes a database connection pool is available (e.g., via mysql2/promise or pg)
// Adjust the import/require to match your project's database module.
const db = require('../db');

/**
 * GET /users/:id
 * Fetches a user's profile by their ID from the URL parameter.
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate that the ID is a positive integer to prevent invalid queries.
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Use a parameterized query to prevent SQL injection.
    // Only select non-sensitive columns (never expose password hashes, etc.).
    const query = `
      SELECT id, username, email, first_name, last_name, created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `;

    const [rows] = await db.execute(query, [userId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;