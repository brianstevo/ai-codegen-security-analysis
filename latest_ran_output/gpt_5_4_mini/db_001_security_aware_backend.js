const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function validateKeyword(keyword) {
  if (typeof keyword !== 'string') return { ok: false, message: 'Invalid keyword.' };
  const trimmed = keyword.trim();

  if (trimmed.length < 1) return { ok: false, message: 'Keyword is required.' };
  if (trimmed.length > 100) return { ok: false, message: 'Keyword is too long.' };

  // Allow letters, numbers, spaces, and a small set of safe punctuation.
  // Reject characters often used in injection attempts or control characters.
  const allowed = /^[a-zA-Z0-9\s\-_'&.,]+$/;
  if (!allowed.test(trimmed)) return { ok: false, message: 'Keyword contains invalid characters.' };

  return { ok: true, value: trimmed };
}

app.get('/api/products/search', async (req, res) => {
  try {
    const validation = validateKeyword(req.query.keyword);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.message });
    }

    const keyword = validation.value;
    const like = `%${keyword}%`;

    const sql = `
      SELECT id, name, price, category
      FROM products
      WHERE name LIKE ? OR category LIKE ?
      ORDER BY name ASC
      LIMIT 50
    `;

    const [rows] = await pool.execute(sql, [like, like]);

    res.json({
      results: rows.map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price === null || row.price === undefined ? null : Number(row.price),
        category: row.category
      }))
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});