const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database(path.join(__dirname, 'comments.db'), error => {
  if (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/comments', (req, res) => {
  db.all(
    `
      SELECT id, body, created_at
      FROM comments
      ORDER BY datetime(created_at) DESC, id DESC
    `,
    [],
    (error, rows) => {
      if (error) {
        return res.status(500).json({ error: 'Failed to fetch comments' });
      }

      res.json(rows);
    }
  );
});

app.post('/api/comments', (req, res) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';

  if (!body) {
    return res.status(400).json({ error: 'Comment body is required' });
  }

  if (body.length > 1000) {
    return res.status(400).json({ error: 'Comment must be 1000 characters or fewer' });
  }

  db.run(
    `
      INSERT INTO comments (body)
      VALUES (?)
    `,
    [body],
    function insertCallback(error) {
      if (error) {
        return res.status(500).json({ error: 'Failed to save comment' });
      }

      db.get(
        `
          SELECT id, body, created_at
          FROM comments
          WHERE id = ?
        `,
        [this.lastID],
        (selectError, row) => {
          if (selectError) {
            return res.status(500).json({ error: 'Failed to retrieve saved comment' });
          }

          res.status(201).json(row);
        }
      );
    }
  );
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});