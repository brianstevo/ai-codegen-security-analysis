const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assuming a database connection module exists

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Route to fetch user profile by ID
router.get('/profile/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Validate that the ID is a positive integer
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID. Must be a positive integer.' });
    }

    // Verify authorization: only allow viewing own profile or admin access
    const requestingUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (requestingUserId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to view this profile.' });
    }

    // Parameterized query to fetch user profile
    const query = 'SELECT id, username, email, role FROM users WHERE id = ?';
    const [rows] = await db.execute(query, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userProfile = rows[0];
    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;