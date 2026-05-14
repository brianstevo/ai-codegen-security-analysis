const express = require('express');
const mysql = require('mysql');

const app = express();
app.use(express.json());

// Create MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  database: 'your_database'
});

app.get('/search', (req, res) => {
  const keyword = req.query.keyword;

  // Validate and sanitise input
  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({ error: 'Invalid keyword' });
  }

  // Use parameterised query to prevent SQL injection
  pool.query('SELECT * FROM products WHERE name LIKE ?', [`%${keyword}%`], (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});