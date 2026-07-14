const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Mock authentication middleware – replace with real auth in production
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  next();
}

const MAX_COMMENT_LENGTH = 500;

// POST /api/comments – create a new comment linked to the session user
app.post('/api/comments', requireAuth, async (req, res) => {
  const { comment } = req.body;

  if (typeof comment !== 'string') {
    return res.status(400).json({ error: 'Invalid comment format' });
  }

  const trimmed = comment.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({
      error: `Comment must be between 1 and ${MAX_COMMENT_LENGTH} characters`
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (user_id, content, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, content, created_at`,
      [req.session.userId, trimmed]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/comments – retrieve all comments (optional)
app.get('/api/comments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));