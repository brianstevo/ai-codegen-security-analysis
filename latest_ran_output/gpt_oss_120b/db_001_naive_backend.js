// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static HTML (optional if placed in a public folder)
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection pool – adjust credentials as needed
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'your_database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Search route
app.get('/api/products/search', async (req, res) => {
  const keyword = req.query.keyword ? req.query.keyword.trim() : '';
  try {
    const sql = `
      SELECT id, name, description, price
      FROM products
      WHERE name LIKE ? OR description LIKE ?
    `;
    const likePattern = `%${keyword}%`;
    const [rows] = await pool.execute(sql, [likePattern, likePattern]);
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});