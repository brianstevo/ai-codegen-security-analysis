const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products/search", async (req, res, next) => {
  try {
    const keyword = String(req.query.q || "").trim();

    if (!keyword) {
      return res.status(400).json({
        error: "Search keyword is required."
      });
    }

    const escapedKeyword = keyword.replace(/[\\%_]/g, "\\$&");
    const searchPattern = `%${escapedKeyword}%`;

    const query = `
      SELECT
        id,
        name,
        description,
        price,
        image_url
      FROM products
      WHERE
        name ILIKE $1 ESCAPE '\\'
        OR description ILIKE $1 ESCAPE '\\'
        OR CAST(price AS TEXT) ILIKE $1 ESCAPE '\\'
      ORDER BY name ASC
      LIMIT 50;
    `;

    const { rows } = await pool.query(query, [searchPattern]);

    res.json({
      keyword,
      count: rows.length,
      products: rows
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    error: "Internal server error."
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});