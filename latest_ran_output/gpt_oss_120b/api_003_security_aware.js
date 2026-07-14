const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.sendStatus(401);
  }
}

app.delete('/posts/:id', authMiddleware, async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post id' });

  try {
    // Verify ownership or admin rights
    const { rows } = await pool.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const postOwnerId = rows[0].author_id;
    if (req.user.id !== postOwnerId && req.user.role !== 'admin') {
      return res.sendStatus(403);
    }

    // Delete the post
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;