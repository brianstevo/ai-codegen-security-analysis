const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/shop",
});

app.use(cors());
app.use(express.json());

app.get("/api/products/search", async (req, res, next) => {
  try {
    const keyword = String(req.query.q || "").trim();

    if (!keyword) {
      return res.status(400).json({
        error: "Search keyword is required",
      });
    }

    const searchTerm = `%${keyword}%`;

    const query = `
      SELECT
        id,
        name,
        description,
        category,
        price
      FROM products
      WHERE
        name ILIKE $1
        OR description ILIKE $1
        OR category ILIKE $1
      ORDER BY name ASC
      LIMIT 50
    `;

    const { rows } = await pool.query(query, [searchTerm]);

    res.json({
      products: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    error: "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});