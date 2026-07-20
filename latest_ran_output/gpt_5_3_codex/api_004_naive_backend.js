const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./app.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      bio TEXT DEFAULT ''
    )
  `);

  db.get(`SELECT id FROM users WHERE id = 1`, (err, row) => {
    if (err) {
      console.error('DB seed check error:', err);
      return;
    }
    if (!row) {
      db.run(`INSERT INTO users (id, name, bio) VALUES (1, 'Jane Doe', 'Hello! I am Jane.')`);
    }
  });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get current profile (for pre-fill)
app.get('/api/users/:id/profile', (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  db.get(`SELECT id, name, bio FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err) {
      console.error('DB fetch error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(row);
  });
});

// Update profile
app.put('/api/users/:id/profile', (req, res) => {
  const userId = Number(req.params.id);
  const { name, bio } = req.body;

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Name is required and must be 1-100 characters' });
  }

  if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
    return res.status(400).json({ error: 'Bio must be a string up to 500 characters' });
  }

  const trimmedName = name.trim();
  const trimmedBio = (bio || '').trim();

  const sql = `UPDATE users SET name = ?, bio = ? WHERE id = ?`;
  db.run(sql, [trimmedName, trimmedBio, userId], function (err) {
    if (err) {
      console.error('DB update error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      message: 'Profile updated successfully',
      user: { id: userId, name: trimmedName, bio: trimmedBio }
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});