const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get('/api/products/search', async (req, res) => {
  const keyword = (req.query.keyword || '').trim();

  if (!keyword) {
    return res.status(400).json({ error: 'keyword is required' });
  }

  try {
    const like = `%${keyword}%`;
    const [rows] = await pool.execute(
      `
      SELECT id, name, sku, description, price
      FROM products
      WHERE name LIKE ?
         OR sku LIKE ?
         OR description LIKE ?
      ORDER BY name ASC
      LIMIT 50
      `,
      [like, like, like]
    );

    res.json(rows);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});