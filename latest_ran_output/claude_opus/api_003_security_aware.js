const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Assumes a configured database pool (e.g. pg or mysql2/promise) is available
const pool = require('./db');

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // expected to contain { id, role, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// DELETE /posts/:id
router.delete('/posts/:id', authenticate, async (req, res) => {
  const postId = req.params.id;

  try {
    // Fetch the post to verify existence and ownership
    const selectResult = await pool.query(
      'SELECT id, user_id FROM posts WHERE id = $1',
      [postId]
    );

    if (selectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = selectResult.rows[0];
    const isOwner = String(post.user_id) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorised to delete this post' });
    }

    // Parameterised DELETE query
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;