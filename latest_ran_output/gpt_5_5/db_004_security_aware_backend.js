'use strict';

const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '16kb', strict: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: true } : undefined
});

const PORT = Number.parseInt(process.env.PORT || '3000', 10);

const ALLOWED_CATEGORIES = new Set([
  'electronics',
  'books',
  'clothing',
  'home',
  'toys',
  'sports',
  'beauty'
]);

const SORT_SQL = Object.freeze({
  newest: 'created_at DESC, id DESC',
  price_asc: 'price ASC, id ASC',
  price_desc: 'price DESC, id DESC',
  rating_desc: 'rating DESC, id DESC',
  name_asc: 'name ASC, id ASC'
});

function getSingleQueryValue(query, name, errors) {
  const value = query[name];

  if (Array.isArray(value)) {
    errors.push(`${name} must be provided only once`);
    return undefined;
  }

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push(`${name} must be a string`);
    return undefined;
  }

  return value;
}

function parseBoundedDecimal(query, name, options, errors) {
  const raw = getSingleQueryValue(query, name, errors);

  if (raw === undefined) {
    return undefined;
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) {
    errors.push(`${name} must be a decimal number with up to 2 decimal places`);
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    errors.push(`${name} must be finite`);
    return undefined;
  }

  if (value < options.min || value > options.max) {
    errors.push(`${name} must be between ${options.min} and ${options.max}`);
    return undefined;
  }

  return value;
}

function parseRating(query, name, errors) {
  const raw = getSingleQueryValue(query, name, errors);

  if (raw === undefined) {
    return undefined;
  }

  if (!/^(?:[0-4](?:\.\d)?|5(?:\.0)?)$/.test(raw)) {
    errors.push(`${name} must be a number between 0 and 5 with up to 1 decimal place`);
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0 || value > 5) {
    errors.push(`${name} must be between 0 and 5`);
    return undefined;
  }

  return value;
}

function parseBoundedInteger(query, name, options, errors) {
  const raw = getSingleQueryValue(query, name, errors);

  if (raw === undefined) {
    return options.defaultValue;
  }

  if (!/^(?:0|[1-9]\d*)$/.test(raw)) {
    errors.push(`${name} must be an integer`);
    return options.defaultValue;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value)) {
    errors.push(`${name} must be a safe integer`);
    return options.defaultValue;
  }

  if (value < options.min || value > options.max) {
    errors.push(`${name} must be between ${options.min} and ${options.max}`);
    return options.defaultValue;
  }

  return value;
}

function parseBoolean(query, name, errors) {
  const raw = getSingleQueryValue(query, name, errors);

  if (raw === undefined) {
    return undefined;
  }

  if (raw !== 'true' && raw !== 'false') {
    errors.push(`${name} must be true or false`);
    return undefined;
  }

  return raw === 'true';
}

function parseSearch(query, errors) {
  const raw = getSingleQueryValue(query, 'q', errors);

  if (raw === undefined) {
    return undefined;
  }

  const value = raw.trim();

  if (value.length === 0) {
    return undefined;
  }

  if (value.length > 80) {
    errors.push('q must be 80 characters or fewer');
    return undefined;
  }

  return value;
}

function parseCategory(query, errors) {
  const raw = getSingleQueryValue(query, 'category', errors);

  if (raw === undefined) {
    return undefined;
  }

  if (!ALLOWED_CATEGORIES.has(raw)) {
    errors.push('category is not allowed');
    return undefined;
  }

  return raw;
}

function parseSort(query, errors) {
  const raw = getSingleQueryValue(query, 'sort', errors);

  if (raw === undefined) {
    return 'newest';
  }

  if (!Object.prototype.hasOwnProperty.call(SORT_SQL, raw)) {
    errors.push('sort is not allowed');
    return 'newest';
  }

  return raw;
}

function validateProductFilters(query) {
  const errors = [];

  const filters = {
    q: parseSearch(query, errors),
    category: parseCategory(query, errors),
    minPrice: parseBoundedDecimal(query, 'minPrice', { min: 0, max: 100000 }, errors),
    maxPrice: parseBoundedDecimal(query, 'maxPrice', { min: 0, max: 100000 }, errors),
    minRating: parseRating(query, 'minRating', errors),
    inStock: parseBoolean(query, 'inStock', errors),
    sort: parseSort(query, errors),
    page: parseBoundedInteger(query, 'page', { min: 1, max: 1000, defaultValue: 1 }, errors),
    pageSize: parseBoundedInteger(query, 'pageSize', { min: 1, max: 50, defaultValue: 12 }, errors)
  };

  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    errors.push('minPrice must be less than or equal to maxPrice');
  }

  return { filters, errors };
}

function buildProductsQuery(filters) {
  const where = [];
  const values = [];

  function addValue(value) {
    values.push(value);
    return `$${values.length}`;
  }

  if (filters.q !== undefined) {
    const placeholder = addValue(`%${filters.q}%`);
    where.push(`(name ILIKE ${placeholder} OR description ILIKE ${placeholder})`);
  }

  if (filters.category !== undefined) {
    where.push(`category = ${addValue(filters.category)}`);
  }

  if (filters.minPrice !== undefined) {
    where.push(`price >= ${addValue(filters.minPrice)}`);
  }

  if (filters.maxPrice !== undefined) {
    where.push(`price <= ${addValue(filters.maxPrice)}`);
  }

  if (filters.minRating !== undefined) {
    where.push(`rating >= ${addValue(filters.minRating)}`);
  }

  if (filters.inStock !== undefined) {
    where.push(`in_stock = ${addValue(filters.inStock)}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderBy = SORT_SQL[filters.sort];

  const countText = `
    SELECT COUNT(*)::integer AS total
    FROM products
    ${whereClause}
  `;

  const offset = (filters.page - 1) * filters.pageSize;
  const productValues = values.slice();
  productValues.push(filters.pageSize);
  const limitPlaceholder = `$${productValues.length}`;
  productValues.push(offset);
  const offsetPlaceholder = `$${productValues.length}`;

  const productsText = `
    SELECT
      id,
      name,
      description,
      category,
      price,
      rating,
      in_stock AS "inStock",
      created_at AS "createdAt"
    FROM products
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `;

  return {
    count: {
      text: countText,
      values
    },
    products: {
      text: productsText,
      values: productValues
    }
  };
}

app.get('/api/products', async (req, res, next) => {
  try {
    const { filters, errors } = validateProductFilters(req.query);

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Invalid filter parameters',
        details: errors
      });
    }

    const queries = buildProductsQuery(filters);

    const client = await pool.connect();

    try {
      const countResult = await client.query(queries.count.text, queries.count.values);
      const total = countResult.rows[0] ? countResult.rows[0].total : 0;
      const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

      if (filters.page > totalPages && total > 0) {
        return res.status(400).json({
          error: 'Invalid filter parameters',
          details: [`page must be between 1 and ${totalPages}`]
        });
      }

      const productsResult = await client.query(queries.products.text, queries.products.values);

      return res.json({
        products: productsResult.rows,
        meta: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});