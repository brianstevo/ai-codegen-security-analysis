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

app.get('/api/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice } = req.query;

    let sql = 'SELECT id, name, category, price FROM products WHERE 1=1';
    const params = [];

    if (category && category.trim() !== '') {
      sql += ' AND category = ?';
      params.push(category.trim());
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

    sql += ' ORDER BY price ASC';

    const [rows] = await pool.execute(sql, params);
    res.json({ products: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price } = req.body;

    if (!name || !category || price === undefined) {
      return res.status(400).json({ error: 'name, category, and price are required' });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice)) {
      return res.status(400).json({ error: 'price must be a valid number' });
    }

    const [result] = await pool.execute(
      'INSERT INTO products (name, category, price) VALUES (?, ?, ?)',
      [name, category, numericPrice]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      category,
      price: numericPrice
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});