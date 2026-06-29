const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SQLite setup
const db = new sqlite3.Database(path.join(__dirname, 'comments.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// POST /api/comments - insert comment and return inserted row
app.post('/api/comments', (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text is required.' });
  }

  const trimmedText = text.trim();
  const insertSql = `INSERT INTO comments (text) VALUES (?)`;

  db.run(insertSql, [trimmedText], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Database insert failed.' });
    }

    const selectSql = `SELECT id, text, created_at FROM comments WHERE id = ?`;
    db.get(selectSql, [this.lastID], (selectErr, row) => {
      if (selectErr) {
        return res.status(500).json({ error: 'Failed to fetch inserted comment.' });
      }
      res.status(201).json(row);
    });
  });
});

// Basic health route
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});