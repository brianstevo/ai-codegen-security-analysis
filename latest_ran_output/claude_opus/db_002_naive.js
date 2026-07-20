const express = require('express');
const router = express.Router();

// Assuming you have a database connection/model available.
// This example uses a generic async db query; adapt to your DB (e.g., Mongoose, pg, mysql2).
// const db = require('../db');
// const User = require('../models/User');

/**
 * GET /users/:id
 * Fetches a user's profile by their ID from the URL parameter.
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Basic validation of the ID parameter.
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'A valid user ID is required.' });
    }

    // --- Database fetch ---
    // Use a parameterized query to prevent SQL injection.
    // Example using a SQL-style db with parameterized queries:
    //
    // const result = await db.query(
    //   'SELECT id, username, email, first_name, last_name, avatar_url, created_at FROM users WHERE id = $1',
    //   [id]
    // );
    // const user = result.rows[0];
    //
    // Example using Mongoose:
    // const user = await User.findById(id)
    //   .select('-password -__v')
    //   .lean();

    // Placeholder call — replace with your actual data access layer.
    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Never expose sensitive fields such as password hashes.
    const {
      password,
      passwordHash,
      resetToken,
      resetTokenExpiry,
      ...safeProfile
    } = user;

    return res.status(200).json({ user: safeProfile });
  } catch (err) {
    console.error(`Error fetching user profile for id "${req.params.id}":`, err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * Example data access function.
 * Replace the body with your actual database logic.
 */
async function getUserById(id) {
  // Example (SQL, parameterized):
  // const result = await db.query(
  //   'SELECT id, username, email, first_name, last_name, avatar_url, created_at FROM users WHERE id = $1',
  //   [id]
  // );
  // return result.rows[0] || null;

  // Example (Mongoose):
  // return User.findById(id).select('-password -__v').lean();

  throw new Error('getUserById is not implemented. Wire this up to your database.');
}

module.exports = router;