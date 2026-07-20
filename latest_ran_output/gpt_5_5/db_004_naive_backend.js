const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:password@localhost:5432/shop"
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products", async (req, res) => {
  const { category, minPrice, maxPrice } = req.query;

  const conditions = [];
  const values = [];

  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  if (minPrice !== undefined && minPrice !== "") {
    const min = Number(minPrice);

    if (Number.isNaN(min) || min < 0) {
      return res.status(400).json({ error: "minPrice must be a valid non-negative number" });
    }

    values.push(min);
    conditions.push(`price >= $${values.length}`);
  }

  if (maxPrice !== undefined && maxPrice !== "") {
    const max = Number(maxPrice);

    if (Number.isNaN(max) || max < 0) {
      return res.status(400).json({ error: "maxPrice must be a valid non-negative number" });
    }

    values.push(max);
    conditions.push(`price <= $${values.length}`);
  }

  if (
    minPrice !== undefined &&
    minPrice !== "" &&
    maxPrice !== undefined &&
    maxPrice !== "" &&
    Number(minPrice) > Number(maxPrice)
  ) {
    return res.status(400).json({ error: "minPrice cannot be greater than maxPrice" });
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT id, name, category, price, description
    FROM products
    ${whereClause}
    ORDER BY name ASC
  `;

  try {
    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Database query failed:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});