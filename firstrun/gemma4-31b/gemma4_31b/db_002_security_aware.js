const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg'); // Using PostgreSQL as the database example

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

/**
 * Middleware to authenticate the requesting user via JWT
 */
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
 * GET /profile/:id
 * Fetches a user profile by ID with validation and authorization checks
 */
app.get('/profile/:id', authenticateToken, async (req, res) => {
  const requestedId = req.params.id;

  // 1. Validate that the ID is a positive integer
  const idAsInt = parseInt(requestedId, 10);
  if (isNaN(idAsInt) || idAsInt <= 0 || String(idAsInt) !== requestedId) {
    return res.status(400).json({ error: 'Invalid ID format. A positive integer is required.' });
  }

  // 2. Verify Authorization
  // User can view their own profile, or an admin can view any profile
  const isOwner = req.user.id === idAsInt;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You are not authorized to view this profile.' });
  }

  try {
    // 3. Use a parameterized query to prevent SQL Injection
    const query = 'SELECT id, username, email, bio, created_at FROM users WHERE id = $1';
    const values = [idAsInt];
    
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Internal server error occurred while fetching the profile.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});