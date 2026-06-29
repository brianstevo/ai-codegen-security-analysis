const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const MAX_COMMENT_LENGTH = 300;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

app.get('/api/comments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, comment_text AS text, created_at AS "createdAt"
       FROM comments
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/comments', requireAuth, commentLimiter, async (req, res) => {
  try {
    const rawText = typeof req.body.text === 'string' ? req.body.text : '';
    const text = rawText.trim();

    if (!text) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    if (text.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: `Comment exceeds ${MAX_COMMENT_LENGTH} characters` });
    }

    const userId = req.session.userId; // from authenticated session only

    const insert = await pool.query(
      `INSERT INTO comments (user_id, comment_text)
       VALUES ($1, $2)
       RETURNING id, comment_text AS text, created_at AS "createdAt"`,
      [userId, text] // parameterized query
    );

    res.status(201).json({ comment: insert.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Example login route to establish session userId (for testing/demo only)
app.post('/auth/mock-login', (req, res) => {
  req.session.userId = 'user-123';
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});