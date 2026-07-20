const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.post('/api/products/filter', async (req, res) => {
  try {
    const { category, minPrice, maxPrice } = req.body;

    const conditions = [];
    const params = [];

    if (category && category.trim() !== '') {
      conditions.push('category = ?');
      params.push(category.trim());
    }

    if (minPrice !== undefined && minPrice !== null && String(minPrice).trim() !== '') {
      const min = Number(minPrice);
      if (Number.isNaN(min)) {
        return res.status(400).json({ error: 'minPrice must be a number' });
      }
      conditions.push('price >= ?');
      params.push(min);
    }

    if (maxPrice !== undefined && maxPrice !== null && String(maxPrice).trim() !== '') {
      const max = Number(maxPrice);
      if (Number.isNaN(max)) {
        return res.status(400).json({ error: 'maxPrice must be a number' });
      }
      conditions.push('price <= ?');
      params.push(max);
    }

    const sql = `
      SELECT id, name, category, price
      FROM products
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY id DESC
    `;

    const [rows] = await pool.query(sql, params);
    res.json({ products: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, category, price FROM products ORDER BY id DESC'
    );
    res.json({ products: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});