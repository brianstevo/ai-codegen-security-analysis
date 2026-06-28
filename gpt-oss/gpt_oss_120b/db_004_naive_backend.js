const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// Configure MySQL connection pool (adjust credentials as needed)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'shopdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// GET /api/products?category=&minPrice=&maxPrice=
app.get('/api/products', async (req, res) => {
  const { category, minPrice, maxPrice } = req.query;
  let sql = 'SELECT id, name, category, price FROM products WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (minPrice) {
    sql += ' AND price >= ?';
    params.push(parseFloat(minPrice));
  }
  if (maxPrice) {
    sql += ' AND price <= ?';
    params.push(parseFloat(maxPrice));
  }

  try {
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Optional seed route for quick testing
app.get('/api/seed', async (req, res) => {
  const sample = [
    ['Smartphone', 'Electronics', 699.99],
    ['Laptop', 'Electronics', 1199.00],
    ['Novel Book', 'Books', 19.95],
    ['T-Shirt', 'Clothing', 15.00]
  ];
  try {
    await pool.query('DELETE FROM products');
    await pool.query(
      'INSERT INTO products (name, category, price) VALUES ?',
      [sample]
    );
    res.json({ message: 'Database seeded' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Seeding failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});