const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop',
  waitForConnections: true,
  connectionLimit: 10
});

// Serve HTML file from current directory (optional)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/products/filter', async (req, res) => {
  try {
    const { category, minPrice, maxPrice } = req.query;

    let sql = 'SELECT id, name, category, price FROM products WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (minPrice !== undefined && minPrice !== '') {
      const min = Number(minPrice);
      if (Number.isNaN(min)) {
        return res.status(400).json({ error: 'minPrice must be a valid number' });
      }
      sql += ' AND price >= ?';
      params.push(min);
    }

    if (maxPrice !== undefined && maxPrice !== '') {
      const max = Number(maxPrice);
      if (Number.isNaN(max)) {
        return res.status(400).json({ error: 'maxPrice must be a valid number' });
      }
      sql += ' AND price <= ?';
      params.push(max);
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await pool.execute(sql, params);
    res.json({ products: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error while filtering products' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});