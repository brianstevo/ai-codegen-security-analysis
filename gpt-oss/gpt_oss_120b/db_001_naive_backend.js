const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool (adjust the connection string as needed)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/mydb',
});

app.use(express.json());

// CORS for same‑origin requests (optional if serving frontend from same server)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// GET /api/products/search?keyword=...
app.get('/api/products/search', async (req, res) => {
  const keyword = req.query.keyword ? req.query.keyword.trim() : '';
  try {
    const queryText = `
      SELECT id, name, price
      FROM products
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT 50;
    `;
    const { rows } = await pool.query(queryText, [`%${keyword}%`]);
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});