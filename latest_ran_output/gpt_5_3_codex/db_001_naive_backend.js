const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop',
  waitForConnections: true,
  connectionLimit: 10
});

app.get('/api/products/search', async (req, res) => {
  try {
    const keyword = (req.query.keyword || '').trim();

    if (!keyword) {
      return res.status(400).json({ error: 'keyword query parameter is required' });
    }

    const likeKeyword = `%${keyword}%`;
    const sql = `
      SELECT id, name, description, price
      FROM products
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY name ASC
      LIMIT 50
    `;

    const [rows] = await pool.execute(sql, [likeKeyword, likeKeyword]);

    res.json({ products: rows });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});