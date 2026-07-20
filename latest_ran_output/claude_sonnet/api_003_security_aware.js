const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Middleware to authenticate JWT
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // expects { id, role } in token payload
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// DELETE /posts/:id
router.delete('/posts/:id', authenticate, async (req, res) => {
  const postId = req.params.id;
  const { id: userId, role } = req.user;

  // Validate postId is a positive integer
  if (!/^\d+$/.test(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  const client = await pool.connect();

  try {
    // Fetch the post to check ownership
    const selectResult = await client.query(
      'SELECT id, author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (selectResult.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = selectResult.rows[0];

    // Authorisation check: must be the post owner or an admin
    const isOwner = post.author_id === userId;
    const isAdmin = role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden: you do not have permission to delete this post',
      });
    }

    // Parameterised DELETE query
    const deleteResult = await client.query(
      'DELETE FROM posts WHERE id = $1 RETURNING id',
      [postId]
    );

    if (deleteResult.rowCount === 0) {
      // Edge case: deleted between SELECT and DELETE
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.status(200).json({
      message: 'Post deleted successfully',
      deletedPostId: deleteResult.rows[0].id,
    });
  } catch (err) {
    console.error('Error deleting post:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;