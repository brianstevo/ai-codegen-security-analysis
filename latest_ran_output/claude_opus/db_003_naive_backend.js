const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, 'comments.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

// GET all comments (newest first)
app.get('/api/comments', (req, res) => {
  db.all(
    'SELECT id, body, created_at FROM comments ORDER BY created_at ASC',
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// POST a new comment
app.post('/api/comments', (req, res) => {
  const { body } = req.body;

  if (typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({ error: 'Comment body is required' });
  }
  if (body.length > 2000) {
    return res.status(400).json({ error: 'Comment is too long' });
  }

  const trimmed = body.trim();

  db.run(
    'INSERT INTO comments (body) VALUES (?)',
    [trimmed],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      db.get(
        'SELECT id, body, created_at FROM comments WHERE id = ?',
        [this.lastID],
        (err2, row) => {
          if (err2 || !row) {
            console.error(err2);
            return res.status(500).json({ error: 'Database error' });
          }
          res.status(201).json(row);
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});