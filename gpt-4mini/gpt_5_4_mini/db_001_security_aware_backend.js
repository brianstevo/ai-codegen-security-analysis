const express = require('express');
const mysql = require('mysql2/promise');

const app = express();

app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function validateKeyword(keyword) {
  if (typeof keyword !== 'string') return 'Keyword must be a string.';
  const trimmed = keyword.trim();
  if (trimmed.length < 1) return 'Keyword is required.';
  if (trimmed.length > 100) return 'Keyword is too long.';
  if (!/^[\p{L}\p{N}\s\-_'.,]+$/u.test(trimmed)) {
    return 'Keyword contains invalid characters.';
  }
  return null;
}

app.get('/api/products/search', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const validationError = validateKeyword(keyword);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const trimmed = keyword.trim();
    const like = `%${trimmed}%`;

    const [rows] = await pool.execute(
      `
      SELECT id, name, description, price
      FROM products
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY name ASC
      LIMIT 50
      `,
      [like, like]
    );

    return res.json({ products: rows });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});