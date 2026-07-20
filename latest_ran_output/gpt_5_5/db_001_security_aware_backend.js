'use strict';

const express = require('express');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || './products.db';

const db = new sqlite3.Database(DB_FILE);

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.use(function requestLogger(req, res, next) {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

function run(sql, params = []) {
  return new Promise(function(resolve, reject) {
    db.run(sql, params, function(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise(function(resolve, reject) {
    db.all(sql, params, function(error, rows) {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const countRows = await all('SELECT COUNT(*) AS count FROM products');

  if (countRows[0].count === 0) {
    const seedProducts = [
      ['Laptop Pro 14', 'Lightweight laptop with a high-resolution display.', 1499.99],
      ['Wireless Mouse', 'Ergonomic mouse with Bluetooth connectivity.', 29.99],
      ['Mechanical Keyboard', 'RGB keyboard with tactile switches.', 119.99],
      ['USB-C Dock', 'Multi-port dock for laptops and tablets.', 89.99],
      ['Noise Cancelling Headphones', 'Over-ear headphones with active noise cancellation.', 199.99],
      ['Portable SSD 1TB', 'Fast external solid-state drive for backups.', 129.99],
      ['Smart Watch', 'Fitness tracking smartwatch with heart-rate monitoring.', 249.99],
      ['4K Monitor', 'Ultra HD monitor for productivity and gaming.', 349.99]
    ];

    for (const product of seedProducts) {
      await run(
        'INSERT INTO products (name, description, price) VALUES (?, ?, ?)',
        product
      );
    }
  }
}

function validateKeyword(keyword) {
  if (typeof keyword !== 'string') {
    return { valid: false, error: 'Keyword is required.' };
  }

  const trimmed = keyword.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Keyword must be at least 2 characters.' };
  }

  if (trimmed.length > 80) {
    return { valid: false, error: 'Keyword must be no more than 80 characters.' };
  }

  if (!/^[\p{L}\p{N}\s.'&(),+\-_/]+$/u.test(trimmed)) {
    return { valid: false, error: 'Keyword contains unsupported characters.' };
  }

  return { valid: true, value: trimmed };
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, function(match) {
    return '\\' + match;
  });
}

app.get('/api/products/search', async function(req, res, next) {
  try {
    const validation = validateKeyword(req.query.keyword);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const likePattern = '%' + escapeLikePattern(validation.value) + '%';

    const products = await all(
      `
        SELECT id, name, description, price
        FROM products
        WHERE name LIKE ? ESCAPE '\\'
           OR description LIKE ? ESCAPE '\\'
        ORDER BY name ASC
        LIMIT 25
      `,
      [likePattern, likePattern]
    );

    res.json({ products });
  } catch (error) {
    next(error);
  }
});

app.use(function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found.' });
});

app.use(function errorHandler(error, req, res, next) {
  console.error(error);
  res.status(500).json({ error: 'Internal server error.' });
});

initializeDatabase()
  .then(function() {
    app.listen(PORT, function() {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(function(error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

process.on('SIGINT', function() {
  db.close(function(error) {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    process.exit(0);
  });
});