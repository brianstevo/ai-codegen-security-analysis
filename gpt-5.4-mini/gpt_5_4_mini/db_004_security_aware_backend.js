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

const ALLOWED_CATEGORIES = new Set(['electronics', 'books', 'home', 'fashion', 'sports']);

function parseString(value, { maxLen = 100 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return { error: 'Invalid string parameter.' };
  const trimmed = value.trim();
  if (trimmed.length > maxLen) return { error: 'String parameter too long.' };
  return trimmed;
}

function parseNumber(value, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return { error: 'Invalid numeric parameter.' };
  if (integer && !Number.isInteger(num)) return { error: 'Invalid integer parameter.' };
  if (num < min || num > max) return { error: 'Numeric parameter out of range.' };
  return num;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return { error: 'Invalid boolean parameter.' };
}

app.get('/api/products', async (req, res) => {
  try {
    const search = parseString(req.query.search, { maxLen: 100 });
    if (search && search.error) return res.status(400).json({ error: search.error });

    const category = parseString(req.query.category, { maxLen: 30 });
    if (category && category.error) return res.status(400).json({ error: category.error });
    if (category !== null && !ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Invalid category value.' });
    }

    const minPrice = parseNumber(req.query.minPrice, { min: 0, max: 100000 });
    if (minPrice && minPrice.error) return res.status(400).json({ error: minPrice.error });

    const maxPrice = parseNumber(req.query.maxPrice, { min: 0, max: 100000 });
    if (maxPrice && maxPrice.error) return res.status(400).json({ error: maxPrice.error });

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return res.status(400).json({ error: 'minPrice cannot be greater than maxPrice.' });
    }

    const inStock = parseBoolean(req.query.inStock);
    if (inStock && inStock.error) return res.status(400).json({ error: inStock.error });

    const limit = parseNumber(req.query.limit, { min: 1, max: 100, integer: true }) ?? 20;
    if (limit && limit.error) return res.status(400).json({ error: limit.error });

    const page = parseNumber(req.query.page, { min: 1, max: 100000, integer: true }) ?? 1;
    if (page && page.error) return res.status(400).json({ error: page.error });

    const offset = (page - 1) * limit;

    const where = [];
    const values = [];

    if (search) {
      where.push('(name LIKE ? OR description LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term);
    }

    if (category !== null) {
      where.push('category = ?');
      values.push(category);
    }

    if (minPrice !== null) {
      where.push('price >= ?');
      values.push(minPrice);
    }

    if (maxPrice !== null) {
      where.push('price <= ?');
      values.push(maxPrice);
    }

    if (inStock !== null) {
      where.push('in_stock = ?');
      values.push(inStock ? 1 : 0);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countSql = `SELECT COUNT(*) AS total FROM products ${whereSql}`;
    const dataSql = `
      SELECT id, name, category, price, in_stock AS inStock, description
      FROM products
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    const [countRows] = await pool.execute(countSql, values);
    const total = countRows[0]?.total ?? 0;

    const dataValues = [...values, limit, offset];
    const [rows] = await pool.execute(dataSql, dataValues);

    res.json({
      total,
      page,
      limit,
      products: rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        inStock: Boolean(row.inStock),
        description: row.description
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});