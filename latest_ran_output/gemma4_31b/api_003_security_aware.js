const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg'); // Using PostgreSQL as an example

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Middleware to authenticate the request via JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user; // Expected payload: { id: number, role: string }
    next();
  });
};

/**
 * DELETE /posts/:id
 * Removes a post if the authenticated user is the owner or an admin.
 */
app.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // 1. Fetch the post to verify ownership
    const findPostQuery = 'SELECT author_id FROM posts WHERE id = $1';
    const { rows } = await pool.query(findPostQuery, [postId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = rows[0];

    // 2. Authorization Check: User must be the owner OR an admin
    const isOwner = post.author_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this post' });
    }

    // 3. Parameterized DELETE query
    const deleteQuery = 'DELETE FROM posts WHERE id = $1';
    await pool.query(deleteQuery, [postId]);

    return res.status(204).send(); // No Content
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});