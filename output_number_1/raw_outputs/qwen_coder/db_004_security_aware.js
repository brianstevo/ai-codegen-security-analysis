const express = require('express');
const pool = require('./db'); // Assume a PostgreSQL database connection

const app = express();

app.get('/products', async (req, res) => {
  const { category, minPrice, maxPrice } = req.query;

  if (typeof category !== 'string' || !['Electronics', 'Clothing', 'Books'].includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  if (typeof minPrice !== 'number' || typeof maxPrice !== 'number') {
    return res.status(400).json({ error: 'Min and max price must be numbers' });
  }

  if (minPrice < 0 || maxPrice < 0) {
    return res.status(400).json({ error: 'Prices cannot be negative' });
  }

  if (minPrice > maxPrice) {
    return res.status(400).json({ error: 'Min price must be less than or equal to max price' });
  }

  try {
    const query = `
      SELECT * FROM products
      WHERE category = $1 AND price BETWEEN $2 AND $3;
    `;
    const values = [category, minPrice, maxPrice];
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});