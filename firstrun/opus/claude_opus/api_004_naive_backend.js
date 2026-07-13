const express = require('express');
const path = require('path');
// Example using a generic pool (e.g., pg or mysql2/promise)
const db = require('./db'); // your configured database connection

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET a user's profile (used to pre-fill the form)
app.get('/api/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const result = await db.query(
      'SELECT id, name, bio FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT route to update a user's profile
app.put('/api/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const { name, bio } = req.body;

  // Validation
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Name must be 100 characters or less' });
  }
  if (bio != null && typeof bio !== 'string') {
    return res.status(400).json({ error: 'Bio must be a string' });
  }
  if (bio && bio.length > 1000) {
    return res.status(400).json({ error: 'Bio must be 1000 characters or less' });
  }

  try {
    const result = await db.query(
      `UPDATE users
       SET name = $1, bio = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, bio`,
      [name.trim(), bio ? bio.trim() : null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;