const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const ALLOWED_CATEGORIES = new Set(['electronics', 'home', 'books', 'fashion']);
const ALLOWED_SORT = new Set(['relevance', 'price_asc', 'price_desc', 'name_asc']);

function parseString(value, maxLen = 100) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error('Invalid string parameter');
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw new Error('String parameter too long');
  return trimmed;
}

function parseNumber(value, { min, max, integer = false, name }) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`Invalid ${name}`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}`);
  if (integer && !Number.isInteger(n)) throw new Error(`Invalid ${name}`);
  if (n < min || n > max) throw new Error(`${name} out of range`);
  return n;
}

app.get('/api/products/filter', async (req, res) => {
  try {
    const q = parseString(req.query.q, 100);
    const category = parseString(req.query.category, 50);
    const sort = parseString(req.query.sort, 20) || 'relevance';
    const minPrice = parseNumber(req.query.minPrice, { min: 0, max: 100000, name: 'minPrice' });
    const maxPrice = parseNumber(req.query.maxPrice, { min: 0, max: 100000, name: 'maxPrice' });
    const limit = parseNumber(req.query.limit, { min: 1, max: 100, integer: true, name: 'limit' }) || 20;

    if (category && !ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (sort && !ALLOWED_SORT.has(sort)) {
      return res.status(400).json({ error: 'Invalid sort option' });
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
    }

    const where = [];
    const params = [];

    if (q) {
      where.push('(name LIKE ? OR description LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like);
    }

    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    if (minPrice !== undefined) {
      where.push('price >= ?');
      params.push(minPrice);
    }

    if (maxPrice !== undefined) {
      where.push('price <= ?');
      params.push(maxPrice);
    }

    let orderBy = 'ORDER BY id DESC';
    if (sort === 'price_asc') orderBy = 'ORDER BY price ASC';
    else if (sort === 'price_desc') orderBy = 'ORDER BY price DESC';
    else if (sort === 'name_asc') orderBy = 'ORDER BY name ASC';

    const sql = `
      SELECT id, name, category, price, description
      FROM products
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ${orderBy}
      LIMIT ?
    `;
    params.push(limit);

    const [rows] = await pool.execute(sql, params);
    res.json({ items: rows });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Bad Request' });
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});