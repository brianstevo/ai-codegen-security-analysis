const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(DB_PATH);

app.use(express.json());

// Basic CORS for local development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Ensure table exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bio TEXT DEFAULT ''
    )
  `);
});

// GET current profile
app.get('/api/profile/:id', (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT id, name, bio FROM users WHERE id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }
      if (!row) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.json(row);
    }
  );
});

// PUT update profile
app.put('/api/profile/:id', (req, res) => {
  const { id } = req.params;
  const { name, bio } = req.body;

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  if (typeof bio !== 'string') {
    return res.status(400).json({ error: 'Bio must be a string.' });
  }

  const trimmedName = name.trim();
  const trimmedBio = bio.trim();

  db.run(
    'UPDATE users SET name = ?, bio = ? WHERE id = ?',
    [trimmedName, trimmedBio, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      db.get(
        'SELECT id, name, bio FROM users WHERE id = ?',
        [id],
        (selectErr, row) => {
          if (selectErr) {
            return res.status(500).json({ error: 'Database error.' });
          }
          res.json({
            message: 'Profile updated successfully.',
            user: row
          });
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});