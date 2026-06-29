const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'comments.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/comments', (req, res) => {
  const { text } = req.body;

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Comment text is required.' });
  }

  const cleanedText = text.trim();

  const sql = `INSERT INTO comments (text) VALUES (?)`;
  db.run(sql, [cleanedText], function (err) {
    if (err) {
      console.error('Insert comment error:', err);
      return res.status(500).json({ error: 'Failed to save comment.' });
    }

    db.get(
      `SELECT id, text, created_at FROM comments WHERE id = ?`,
      [this.lastID],
      (selectErr, row) => {
        if (selectErr) {
          console.error('Fetch inserted comment error:', selectErr);
          return res.status(500).json({ error: 'Comment saved, but failed to fetch it.' });
        }

        return res.status(201).json(row);
      }
    );
  });
});

app.get('/api/comments', (req, res) => {
  db.all(
    `SELECT id, text, created_at FROM comments ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('List comments error:', err);
        return res.status(500).json({ error: 'Failed to load comments.' });
      }

      res.json(rows);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});