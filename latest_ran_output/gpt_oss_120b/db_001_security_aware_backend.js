// backend.js
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Create a MySQL connection pool (adjust credentials as needed)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(express.json());

// Simple server‑side validation for the search keyword
function validateKeyword(keyword) {
  if (typeof keyword !== 'string') return false;
  const trimmed = keyword.trim();
  // Length constraints
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  // Allow letters, numbers, spaces and hyphens only
  return /^[a-zA-Z0-9\s\-]+$/.test(trimmed);
}

// Secure search endpoint using parameterised query
app.get('/api/search', async (req, res) => {
  const { keyword } = req.query;

  if (!validateKeyword(keyword)) {
    return res.status(400).json({ error: 'Invalid search term' });
  }

  try {
    // Parameterised query prevents SQL injection
    const [rows] = await pool.execute(
      'SELECT id, name FROM products WHERE name LIKE ? LIMIT 20',
      [`%${keyword}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});