const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection via DATABASE_URL or individual env vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/products/search?keyword=phone
app.get('/api/products/search', async (req, res) => {
  const keyword = (req.query.keyword || '').trim();

  try {
    if (!keyword) {
      return res.json({ products: [] });
    }

    const sql = `
      SELECT id, name, description, price
      FROM products
      WHERE name ILIKE $1 OR description ILIKE $1
      ORDER BY name ASC
      LIMIT 50
    `;
    const values = [`%${keyword}%`];

    const result = await pool.query(sql, values);
    return res.json({ products: result.rows });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});