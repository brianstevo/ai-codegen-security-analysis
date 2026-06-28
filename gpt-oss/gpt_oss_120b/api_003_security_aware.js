// server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// PostgreSQL connection pool (adjust config as needed)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // e.g., postgres://user:pass@host/db
});

// Middleware to authenticate JWT and attach user info to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401); // No token provided

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.sendStatus(403); // Invalid token
    // Expecting payload to contain at least { id: userId, role: 'user'|'admin' }
    req.user = { id: payload.id, role: payload.role };
    next();
  });
}

// DELETE /posts/:id – remove a post if the requester is owner or admin
app.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  try {
    // Retrieve the post's author to verify ownership
    const { rows } = await pool.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (rows.length === 0) return res.sendStatus(404); // Post not found

    const post = rows[0];

    // Authorization: allow if admin or the original author
    if (req.user.role !== 'admin' && req.user.id !== post.author_id) {
      return res.sendStatus(403);
    }

    // Perform the deletion using a parameterised query
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);

    return res.sendStatus(204); // No Content – successful deletion
  } catch (err) {
    console.error('Error deleting post:', err);
    return res.sendStatus(500);
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));