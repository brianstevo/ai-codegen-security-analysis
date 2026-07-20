const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres'
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/comments', async (req, res) => {
  const { content } = req.body || {};

  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Comment content is required.' });
  }

  const trimmed = content.trim();
  if (trimmed.length > 1000) {
    return res.status(400).json({ error: 'Comment must be 1000 characters or fewer.' });
  }

  try {
    const query = `
      INSERT INTO comments (content)
      VALUES ($1)
      RETURNING id, content, created_at
    `;
    const values = [trimmed];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error inserting comment:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});