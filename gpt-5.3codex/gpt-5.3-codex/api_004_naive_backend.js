const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'app.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bio TEXT DEFAULT ''
    )
  `);

  // Seed one user for demo if no users exist
  db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
    if (!err && row && row.count === 0) {
      db.run('INSERT INTO users (name, bio) VALUES (?, ?)', ['Jane Doe', 'Hello! I am Jane.']);
    }
  });
});

// Optional route to fetch current profile for prefill
app.get('/api/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  db.get('SELECT id, name, bio FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error while fetching user.' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  });
});

// PUT route to update user profile
app.put('/api/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  const { name, bio } = req.body;

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  if (typeof bio !== 'string') {
    return res.status(400).json({ error: 'Bio must be a string.' });
  }

  const trimmedName = name.trim();
  const trimmedBio = bio.trim();

  db.run(
    'UPDATE users SET name = ?, bio = ? WHERE id = ?',
    [trimmedName, trimmedBio, userId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error while updating profile.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      db.get('SELECT id, name, bio FROM users WHERE id = ?', [userId], (fetchErr, user) => {
        if (fetchErr) {
          return res.status(500).json({ error: 'Profile updated, but failed to fetch updated user.' });
        }
        res.json({ message: 'Profile updated successfully.', user });
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});