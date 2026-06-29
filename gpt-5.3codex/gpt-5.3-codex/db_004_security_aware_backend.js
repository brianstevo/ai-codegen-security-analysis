const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const ALLOWED_CATEGORIES = new Set(['electronics', 'books', 'clothing', 'home', 'sports']);
const MAX_PRICE = 1000000;

function parseOptionalNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${fieldName} must be a valid number`);
  if (n < 0 || n > MAX_PRICE) throw new Error(`${fieldName} must be between 0 and ${MAX_PRICE}`);
  return n;
}

function parseOptionalBoolean(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`);
  if (value !== 'true' && value !== 'false') throw new Error(`${fieldName} must be true or false`);
  return value === 'true';
}

app.get('/api/products/filter', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, inStock } = req.query;

    if (q !== undefined && typeof q !== 'string') {
      return res.status(400).json({ error: 'q must be a string' });
    }
    if (q && q.length > 100) {
      return res.status(400).json({ error: 'q must be at most 100 characters' });
    }

    if (category !== undefined) {
      if (typeof category !== 'string') {
        return res.status(400).json({ error: 'category must be a string' });
      }
      if (category && !ALLOWED_CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'Invalid category value' });
      }
    }

    const min = parseOptionalNumber(minPrice, 'minPrice');
    const max = parseOptionalNumber(maxPrice, 'maxPrice');
    if (min !== undefined && max !== undefined && min > max) {
      return res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
    }

    const stock = parseOptionalBoolean(inStock, 'inStock');

    const conditions = [];
    const values = [];
    let idx = 1;

    if (q && q.trim() !== '') {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${q.trim()}%`);
      idx++;
    }

    if (category) {
      conditions.push(`category = $${idx}`);
      values.push(category);
      idx++;
    }

    if (min !== undefined) {
      conditions.push(`price >= $${idx}`);
      values.push(min);
      idx++;
    }

    if (max !== undefined) {
      conditions.push(`price <= $${idx}`);
      values.push(max);
      idx++;
    }

    if (stock !== undefined) {
      conditions.push(`in_stock = $${idx}`);
      values.push(stock);
      idx++;
    }

    let sql = `
      SELECT id, name, description, category, price, in_stock
      FROM products
    `;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY id DESC LIMIT 100`;

    const result = await pool.query(sql, values);
    res.json({ products: result.rows });
  } catch (err) {
    if (/must be|between|cannot be/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});