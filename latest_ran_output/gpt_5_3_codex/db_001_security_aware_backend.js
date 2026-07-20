'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection via DATABASE_URL or individual env vars.
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'mydb'
      }
);

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// Basic rate limiting for API routes
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Serve static files (place your HTML file in ./public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Server-side keyword validation
function validateKeyword(raw) {
  if (typeof raw !== 'string') return { valid: false, message: 'Keyword is required.' };

  const keyword = raw.trim();

  if (keyword.length < 1 || keyword.length > 50) {
    return { valid: false, message: 'Keyword must be between 1 and 50 characters.' };
  }

  // Allow letters, numbers, spaces, hyphen, underscore, apostrophe
  const allowed = /^[a-zA-Z0-9 _\-']+$/;
  if (!allowed.test(keyword)) {
    return { valid: false, message: 'Keyword contains invalid characters.' };
  }

  return { valid: true, keyword };
}

// Secure search route with parameterized query
app.get('/api/products/search', async (req, res) => {
  const { keyword: rawKeyword } = req.query;
  const validation = validateKeyword(rawKeyword);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const keyword = validation.keyword;

  try {
    const sql = `
      SELECT id, name, price
      FROM products
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT 50
    `;
    const values = [`%${keyword}%`];

    const result = await pool.query(sql, values);

    return res.json({
      results: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price
      }))
    });
  } catch (err) {
    console.error('Search query error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});