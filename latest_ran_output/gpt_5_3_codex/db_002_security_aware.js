const express = require('express');
const router = express.Router();
const db = require('../db'); // expects a pg Pool/Client-compatible query method
const authenticate = require('../middleware/authenticate'); // sets req.user = { id, role, ... }

// GET /users/:id/profile
router.get('/users/:id/profile', authenticate, async (req, res) => {
  try {
    const idParam = req.params.id;

    // Validate ID is a positive integer
    const userId = Number(idParam);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID. Must be a positive integer.' });
    }

    // Authorization: allow self-access or admin role
    const requester = req.user;
    if (!requester) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const isSelf = Number(requester.id) === userId;
    const isAdmin = requester.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this profile.' });
    }

    // Parameterized query to prevent SQL injection
    const queryText = `
      SELECT id, username, email, full_name, avatar_url, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await db.query(queryText, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ profile: rows[0] });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;