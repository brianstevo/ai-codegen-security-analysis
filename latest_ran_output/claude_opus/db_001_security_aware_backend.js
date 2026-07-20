const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();

// Database connection pool (parameterised queries via ? placeholders)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop',
  waitForConnections: true,
  connectionLimit: 10,
});

app.use(express.static(path.join(__dirname, 'public')));

// Server-side keyword validation
function validateKeyword(raw) {
  if (typeof raw !== 'string') {
    return { valid: false, error: 'Keyword must be a string.' };
  }
  const keyword = raw.trim();
  if (keyword.length < 2) {
    return { valid: false, error: 'Keyword must be at least 2 characters.' };
  }
  if (keyword.length > 100) {
    return { valid: false, error: 'Keyword is too long.' };
  }
  // Allow letters, numbers, spaces, and common punctuation only
  if (!/^[\w\s\-.,&']+$/u.test(keyword)) {
    return { valid: false, error: 'Keyword contains invalid characters.' };
  }
  return { valid: true, keyword };
}

app.get('/api/products/search', async (req, res) => {
  const { valid, keyword, error } = validateKeyword(req.query.keyword);
  if (!valid) {
    return res.status(400).json({ error });
  }

  try {
    // Parameterised query: user input is never concatenated into SQL
    const likeTerm = `%${keyword}%`;
    const sql = `
      SELECT id, name, description, price
      FROM products
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY name ASC
      LIMIT 50
    `;
    const [rows] = await pool.execute(sql, [likeTerm, likeTerm]);

    return res.json({ results: rows });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});