const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());

app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const ALLOWED_CATEGORIES = new Set(['electronics', 'books', 'clothing', 'home', 'sports']);

function parseBoolean(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function validateAndNormalizeQuery(query) {
  const out = {};
  const errors = [];

  if (query.q !== undefined) {
    if (typeof query.q !== 'string') {
      errors.push('q must be a string');
    } else {
      const q = query.q.trim();
      if (q.length > 100) errors.push('q must be <= 100 characters');
      else if (q.length > 0) out.q = q;
    }
  }

  if (query.category !== undefined) {
    if (typeof query.category !== 'string') {
      errors.push('category must be a string');
    } else if (!ALLOWED_CATEGORIES.has(query.category)) {
      errors.push('category is invalid');
    } else {
      out.category = query.category;
    }
  }

  if (query.minPrice !== undefined) {
    const n = Number(query.minPrice);
    if (!Number.isFinite(n)) errors.push('minPrice must be a number');
    else if (n < 0 || n > 1000000) errors.push('minPrice out of range');
    else out.minPrice = n;
  }

  if (query.maxPrice !== undefined) {
    const n = Number(query.maxPrice);
    if (!Number.isFinite(n)) errors.push('maxPrice must be a number');
    else if (n < 0 || n > 1000000) errors.push('maxPrice out of range');
    else out.maxPrice = n;
  }

  if (out.minPrice !== undefined && out.maxPrice !== undefined && out.minPrice > out.maxPrice) {
    errors.push('minPrice cannot be greater than maxPrice');
  }

  if (query.minRating !== undefined) {
    const n = Number(query.minRating);
    if (!Number.isFinite(n)) errors.push('minRating must be a number');
    else if (n < 0 || n > 5) errors.push('minRating must be between 0 and 5');
    else out.minRating = n;
  }

  if (query.inStock !== undefined) {
    const b = parseBoolean(query.inStock);
    if (b === null) errors.push('inStock must be "true" or "false"');
    else out.inStock = b;
  }

  return { errors, filters: out };
}

app.get('/api/products/filter', async (req, res) => {
  const { errors, filters } = validateAndNormalizeQuery(req.query);

  if (errors.length) {
    return res.status(400).json({ error: 'Invalid query parameters', details: errors });
  }

  const where = [];
  const values = [];
  let i = 1;

  if (filters.q !== undefined) {
    where.push(`name ILIKE $${i++}`);
    values.push(`%${filters.q}%`);
  }

  if (filters.category !== undefined) {
    where.push(`category = $${i++}`);
    values.push(filters.category);
  }

  if (filters.minPrice !== undefined) {
    where.push(`price >= $${i++}`);
    values.push(filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    where.push(`price <= $${i++}`);
    values.push(filters.maxPrice);
  }

  if (filters.minRating !== undefined) {
    where.push(`rating >= $${i++}`);
    values.push(filters.minRating);
  }

  if (filters.inStock !== undefined) {
    where.push(`in_stock = $${i++}`);
    values.push(filters.inStock);
  }

  const sql = `
    SELECT id, name, category, price, rating, in_stock
    FROM products
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY id DESC
    LIMIT 100
  `;

  try {
    const { rows } = await pool.query(sql, values);
    res.json({ products: rows });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});