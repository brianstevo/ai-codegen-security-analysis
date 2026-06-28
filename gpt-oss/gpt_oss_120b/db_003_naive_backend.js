const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());

// Serve static files (HTML page)
app.use(express.static(path.join(__dirname, 'public')));

// Initialize in‑memory SQLite DB
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// GET all comments
app.get('/api/comments', (req, res) => {
  db.all('SELECT id, text FROM comments ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST a new comment
app.post('/api/comments', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text is required' });

  db.run('INSERT INTO comments (text) VALUES (?)', [text], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const insertedId = this.lastID;
    db.get('SELECT id, text FROM comments WHERE id = ?', [insertedId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));