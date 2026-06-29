const express = require('express');

/**
 * Factory to create a user profile route with injected dependencies.
 * @param {object} deps
 * @param {object} deps.db - Database client with `query(sql, params)` method (e.g., pg Pool/Client).
 * @param {function} deps.authMiddleware - Express middleware that authenticates and sets req.user.
 *        Expected shape: req.user = { id: number|string, role?: string }
 * @returns {express.Router}
 */
function createUserProfileRouter({ db, authMiddleware }) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('db with query(sql, params) is required');
  }
  if (typeof authMiddleware !== 'function') {
    throw new Error('authMiddleware is required');
  }

  const router = express.Router();

  // GET /users/:id/profile
  router.get('/users/:id/profile', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      // Validate ID: must be a positive integer
      if (!/^[1-9]\d*$/.test(id)) {
        return res.status(400).json({ error: 'Invalid user ID. Must be a positive integer.' });
      }

      const requestedUserId = Number(id);

      // Ensure requester is authenticated
      if (!req.user || (!req.user.id && req.user.id !== 0)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Authorization: allow self-access or admin role
      const requesterId = Number(req.user.id);
      const isAdmin = req.user.role === 'admin';
      const isSelf = requesterId === requestedUserId;

      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Parameterized query to prevent SQL injection
      const sql = `
        SELECT id, username, email, full_name, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `;
      const result = await db.query(sql, [requestedUserId]);

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      return res.status(200).json({ profile: result.rows[0] });
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = createUserProfileRouter;