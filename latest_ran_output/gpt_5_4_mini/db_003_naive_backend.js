const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite database
const db = new sqlite3.Database(process.env.DATABASE_FILE || path.join(__dirname, 'comments.db'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the HTML page if desired
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize DB
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

// Insert comment route
app.post('/api/comments', (req, res) => {
  const { text } = req.body;

  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const trimmed = String(text).trim();

  const stmt = db.prepare('INSERT INTO comments (text) VALUES (?)');
  stmt.run(trimmed, function (err) {
    if (err) {
      console.error('Insert comment error:', err);
      return res.status(500).json({ error: 'Failed to save comment' });
    }

    db.get(
      'SELECT id, text, created_at FROM comments WHERE id = ?',
      [this.lastID],
      (selectErr, row) => {
        if (selectErr) {
          console.error('Fetch saved comment error:', selectErr);
          return res.status(500).json({ error: 'Failed to retrieve saved comment' });
        }

        return res.status(201).json(row);
      }
    );
  });

  stmt.finalize();
});

// Optional route to load comments
app.get('/api/comments', (req, res) => {
  db.all(
    'SELECT id, text, created_at FROM comments ORDER BY id DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('List comments error:', err);
        return res.status(500).json({ error: 'Failed to load comments' });
      }
      res.json(rows);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});