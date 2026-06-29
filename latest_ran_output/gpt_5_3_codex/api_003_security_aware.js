const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('./db'); // expects a pg Pool/Client-like interface with db.query(text, params)

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      role: payload.role, // e.g. 'admin' or 'user'
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.delete('/posts/:postId', authenticate, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    // Fetch ownership info first
    const postResult = await db.query(
      'SELECT id, author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];
    const isOwner = Number(post.author_id) === Number(req.user.id);
    const isAdmin = req.user.role === 'admin';

    // Authorization check: only owner or admin can delete
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Parameterized delete query
    await db.query('DELETE FROM posts WHERE id = $1', [postId]);

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;