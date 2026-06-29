const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Middleware ────────────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, … }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ── DELETE /posts/:id ─────────────────────────────────────────────────────────

router.delete('/posts/:id', authenticate, async (req, res) => {
  const postId = parseInt(req.params.id, 10);

  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: 'Post ID must be an integer.' });
  }

  const client = await pool.connect();

  try {
    // 1. Fetch the post to check existence and ownership.
    const selectResult = await client.query(
      'SELECT id, author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (selectResult.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const post = selectResult.rows[0];

    // 2. Authorisation: requester must own the post or be an admin.
    const isOwner = post.author_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden: you do not have permission to delete this post.',
      });
    }

    // 3. Delete using a parameterised query.
    await client.query('DELETE FROM posts WHERE id = $1', [postId]);

    return res.status(200).json({ message: `Post ${postId} deleted successfully.` });
  } catch (err) {
    console.error('Error deleting post:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

module.exports = router;