const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg'); // Using pg for parameterized queries

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Middleware to authenticate the requesting user via JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user; // Expected to contain { id: number, role: string }
    next();
  });
};

/**
 * GET /api/users/:id
 * Fetches a user profile by ID with validation and authorization checks.
 */
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  const userIdParam = req.params.id;

  // 1. Validation: Ensure the ID is a positive integer
  const userId = parseInt(userIdParam, 10);
  if (isNaN(userId) || userId <= 0 || userId.toString() !== userIdParam) {
    return res.status(400).json({ error: 'Invalid User ID. Must be a positive integer.' });
  }

  try {
    // 2. Authorization: Verify if the requesting user is authorized to view this profile
    // Logic: Users can view their own profile, or an admin can view any profile.
    const isOwner = req.user.id === userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to view this profile.' });
    }

    // 3. Parameterized Query: Prevent SQL Injection
    const query = {
      text: 'SELECT id, username, email, created_at FROM users WHERE id = $1',
      values: [userId],
    };

    const { rows } = await pool.query(query);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    // Return the user data
    res.json(rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});