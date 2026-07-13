'use strict';

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection via environment variable DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// Serve the HTML file if needed (place HTML as public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Basic keyword validator
function validateKeyword(input) {
  if (typeof input !== 'string') return { valid: false, message: 'Keyword must be a string.' };

  const keyword = input.trim();
  if (keyword.length < 1 || keyword.length > 50) {
    return { valid: false, message: 'Keyword must be between 1 and 50 characters.' };
  }

  // Allow letters, numbers, spaces, dash, underscore, apostrophe, dot
  const allowed = /^[a-zA-Z0-9\s\-_.']+$/;
  if (!allowed.test(keyword)) {
    return { valid: false, message: 'Keyword contains invalid characters.' };
  }

  return { valid: true, keyword };
}

app.get('/api/products/search', searchLimiter, async (req, res) => {
  const { keyword } = req.query;
  const validation = validateKeyword(keyword);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    // Parameterized query prevents SQL injection
    const sql = `
      SELECT id, name, price
      FROM products
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT 50
    `;
    const values = [`%${validation.keyword}%`];

    const result = await pool.query(sql, values);

    return res.json({ results: result.rows });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});