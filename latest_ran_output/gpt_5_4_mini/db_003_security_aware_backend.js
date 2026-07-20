const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const db = new sqlite3.Database('./comments.db');

const MAX_COMMENT_LENGTH = 500;

app.use(express.json());
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './' }),
  secret: process.env.SESSION_SECRET || 'replace-with-a-long-random-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/comments', (req, res) => {
  db.all(
    'SELECT id, user_id, content, created_at FROM comments ORDER BY id DESC LIMIT 100',
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
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

  if (!content) {
    return res.status(400).json({ error: 'Comment is required' });
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` });
  }

  const userId = req.session.userId;

  db.run(
    'INSERT INTO comments (user_id, content) VALUES (?, ?)',
    [userId, content],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      db.get(
        'SELECT id, user_id, content, created_at FROM comments WHERE id = ?',
        [this.lastID],
        (selectErr, row) => {
          if (selectErr) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.status(201).json({ comment: row });
        }
      );
    }
  );
});

// Example login route to populate the authenticated session ID.
// In a real app, replace with proper authentication.
app.post('/login-demo', (req, res) => {
  const userId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  req.session.userId = userId;
  res.json({ ok: true, userId });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});