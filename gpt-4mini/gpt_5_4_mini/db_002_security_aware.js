const express = require('express');
const router = express.Router();

// Example auth middleware assumed to populate req.user
// req.user = { id: number, role: string, ... }

router.get('/users/:id', async (req, res) => {
  try {
    const requestedId = Number(req.params.id);

    if (!Number.isInteger(requestedId) || requestedId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isSelf = req.user.id === requestedId;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Assumes you have a configured database client available as `db`
    // Example for pg: const db = require('../db');
    const { rows } = await db.query(
      'SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1',
      [requestedId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;