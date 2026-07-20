const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Replace with your actual database credentials
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shopdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.post('/api/products/search', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const q = `%${keyword.trim()}%`;

    const [rows] = await pool.execute(
      `
      SELECT id, name, description, price
      FROM products
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY name ASC
      LIMIT 100
      `,
      [q, q]
    );

    res.json({ results: rows });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});