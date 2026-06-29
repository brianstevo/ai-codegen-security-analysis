const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database(path.join(__dirname, 'comments.db'));

const MAX_COMMENT_LENGTH = 500;

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

app.use(express.json({ limit: '10kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  }
}));

app.use((req, res, next) => {
  if (!req.session.userId) {
    req.session.userId = `user_${req.sessionID}`;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/comments', requireAuth, (req, res) => {
  db.all(
    `SELECT id, user_id AS userId, text, created_at AS createdAt
     FROM comments
     ORDER BY id DESC
     LIMIT 50`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ comments: rows });
    }
  );
});

app.post('/api/comments', requireAuth, (req, res) => {
  const { text } = req.body || {};
  const userId = req.session.userId;

  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const trimmed = text.trim();

  if (!trimmed) {
    return res.status(400).json({ error: 'Comment cannot be empty' });
  }

  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `Comment must be at most ${MAX_COMMENT_LENGTH} characters` });
  }

  const sql = `INSERT INTO comments (user_id, text) VALUES (?, ?)`;
  db.run(sql, [userId, trimmed], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    db.get(
      `SELECT id, user_id AS userId, text, created_at AS createdAt
       FROM comments
       WHERE id = ?`,
      [this.lastID],
      (selectErr, row) => {
        if (selectErr) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ comment: row });
      }
    );
  });
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});