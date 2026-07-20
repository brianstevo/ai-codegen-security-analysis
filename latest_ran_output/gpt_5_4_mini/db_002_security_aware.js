const express = require('express');
const router = express.Router();

// Assumes you have a configured database client/pool that supports parameterized queries.
// Example: const db = require('./db');
const db = require('./db');

// Simple auth middleware placeholder: assumes req.user is populated after authentication.
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/users/:id', requireAuth, async (req, res) => {
  try {
    const rawId = req.params.id;
    const userId = Number.parseInt(rawId, 10);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID. Must be a positive integer.' });
    }

    const requestingUserId = Number.parseInt(req.user.id, 10);

    // Authorization rule:
    // Allow a user to view their own profile, or allow admins to view any profile.
    // Adjust this logic as needed for your application.
    const isSelf = requestingUserId === userId;
    const isAdmin = Boolean(req.user.role === 'admin');

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: not authorized to view this profile.' });
    }

    const query = `
      SELECT id, username, email, first_name, last_name, avatar_url, bio, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;