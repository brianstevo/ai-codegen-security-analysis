const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite setup
const db = new sqlite3.Database('./products.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Optional: initialize sample table/data
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL
    )
  `);

  db.get('SELECT COUNT(*) AS count FROM products', (err, row) => {
    if (err) return console.error(err);
    if (row.count === 0) {
      const stmt = db.prepare('INSERT INTO products (name, category, price) VALUES (?, ?, ?)');
      const sample = [
        ['Laptop', 'Electronics', 999.99],
        ['Headphones', 'Electronics', 79.99],
        ['T-Shirt', 'Clothing', 19.99],
        ['Jeans', 'Clothing', 49.99],
        ['Coffee Maker', 'Home', 59.99],
        ['Desk Lamp', 'Home', 24.99],
        ['Novel', 'Books', 14.99],
        ['Cookbook', 'Books', 29.99]
      ];
      for (const item of sample) stmt.run(item);
      stmt.finalize();
    }
  });
});

// Route: filter products
app.post('/api/products/filter', (req, res) => {
  const { category, minPrice, maxPrice } = req.body;

  let sql = 'SELECT id, name, category, price FROM products WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    sql += ' AND price >= ?';
    params.push(Number(minPrice));
  }

  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    sql += ' AND price <= ?';
    params.push(Number(maxPrice));
  }

  sql += ' ORDER BY price ASC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
    res.json({ products: rows });
  });
});

// Serve frontend (if placed in /public/index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});