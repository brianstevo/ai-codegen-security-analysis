const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./comments.db');
const MAX_COMMENT_LENGTH = 500;

// Basic hardening
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'replace-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// Demo auth middleware: ensure a user is associated with the session
app.use((req, res, next) => {
  if (!req.session.userId) {
    // In real app, set this after login only.
    req.session.userId = 1;
  }
  next();
});

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/comments', (req, res) => {
  db.all(
    `SELECT id, user_id, content, created_at
     FROM comments
     ORDER BY id DESC
     LIMIT 100`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ comments: rows });
    }
  );
});

app.post('/api/comments', commentLimiter, (req, res) => {
  const userId = req.session.userId; // from authenticated session, not request body
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!content) {
    return res.status(400).json({ error: 'Comment is required' });
  }
  if (content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `Comment must be <= ${MAX_COMMENT_LENGTH} characters` });
  }

  const sql = `INSERT INTO comments (user_id, content) VALUES (?, ?)`;
  const params = [userId, content]; // parameterized query to prevent SQL injection

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: 'Database error' });

    db.get(
      `SELECT id, user_id, content, created_at FROM comments WHERE id = ?`,
      [this.lastID],
      (selectErr, row) => {
        if (selectErr) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ comment: row });
      }
    );
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});