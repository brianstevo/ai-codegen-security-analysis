const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// GET /api/products/search?q=keyword
app.get('/api/products/search', async (req, res) => {
  const keyword = (req.query.q || '').trim();

  if (!keyword) {
    return res.status(400).json({ error: 'Missing search keyword' });
  }

  try {
    const like = `%${keyword}%`;
    const [rows] = await pool.query(
      `SELECT id, name, price, description
       FROM products
       WHERE name LIKE ? OR description LIKE ?
       ORDER BY name ASC
       LIMIT 50`,
      [like, like]
    );
    res.json(rows);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});