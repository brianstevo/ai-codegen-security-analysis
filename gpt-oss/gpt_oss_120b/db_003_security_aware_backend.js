const express = require('express');
const session = require('express-session');
const pg = require('pg');
const bodyParser = require('body-parser');

const app = express();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' }
}));

app.use(bodyParser.json());

// Mock auth – replace with real authentication
app.use((req, res, next) => {
  if (!req.session.userId) req.session.userId = 1;
  next();
});

const MAX_COMMENT_LENGTH = 500;

app.get('/api/comments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, content, created_at FROM comments ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/api/comments', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ message: 'Invalid comment format' });

  const trimmed = content.trim();
  if (!trimmed) return res.status(400).json({ message: 'Comment cannot be empty' });
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ message: `Comment exceeds ${MAX_COMMENT_LENGTH} characters` });
  }

  try {
    const insertQuery = `
      INSERT INTO comments (user_id, content, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id, user_id, content, created_at
    `;
    const values = [userId, trimmed];
    const result = await pool.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save comment' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});