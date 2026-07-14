const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming you have a database connection module

// Middleware to check if the user is authenticated (you should implement this)
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (!user.rows[0]) {
      throw new Error();
    }
    req.user = user.rows[0];
    next();
  } catch (err) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// Middleware to check if the requesting user is authorized to view the profile
const authorizeProfileAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Check if the requesting user is the owner of the profile or an admin
    const isAdmin = req.user.is_admin;
    const isOwner = req.user.id === parseInt(id);

    if (!isAdmin && !isOwner) {
      return res.status(403).send({ error: 'Not authorized to view this profile.' });
    }
    next();
  } catch (err) {
    res.status(500).send({ error: 'Server error' });
  }
};

// Route to fetch user profile by ID
router.get('/users/:id', authenticateUser, authorizeProfileAccess, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate that the ID is a positive integer
    if (!/^\d+$/.test(id)) {
      return res.status(400).send({ error: 'ID must be a positive integer.' });
    }

    const userId = parseInt(id, 10);
    if (userId <= 0) {
      return res.status(400).send({ error: 'ID must be a positive integer.' });
    }

    // Fetch the user profile using parameterized query
    const userResult = await db.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).send({ error: 'User not found.' });
    }

    // Return the user profile
    res.send(userResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Server error' });
  }
});

module.exports = router;