const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// PostgreSQL connection pool (configure via env vars)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware: verify JWT and attach payload to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.sendStatus(403);
    // Expect payload to contain at least { id: Number, role: String }
    req.user = payload;
    next();
  });
}

// GET /users/:id – fetch user profile
router.get('/users/:id', authenticateToken, async (req, res) => {
  const rawId = req.params.id;
  const userId = Number(rawId);

  // Validate ID is a positive integer
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'User ID must be a positive integer' });
  }

  // Authorization: allow self or admin role
  const requester = req.user; // { id, role }
  if (requester.id !== userId && requester.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  try {
    const sql = `
      SELECT id, username, email, created_at
      FROM users
      WHERE id = $1
    `;
    const { rows } = await pool.query(sql, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return profile (exclude sensitive fields like password)
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;