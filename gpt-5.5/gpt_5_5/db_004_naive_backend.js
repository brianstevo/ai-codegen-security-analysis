const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "products.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(DB_FILE, (error) => {
  if (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }

  console.log("Connected to SQLite database.");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0)
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM products", (error, row) => {
    if (error) {
      console.error("Failed to count products:", error.message);
      return;
    }

    if (row.count === 0) {
      const insert = db.prepare(`
        INSERT INTO products (name, category, price)
        VALUES (?, ?, ?)
      `);

      [
        ["Wireless Headphones", "electronics", 89.99],
        ["Bluetooth Speaker", "electronics", 49.99],
        ["Laptop Stand", "electronics", 34.5],
        ["Cotton T-Shirt", "clothing", 19.99],
        ["Denim Jacket", "clothing", 79.0],
        ["Running Shoes", "sports", 115.25],
        ["Yoga Mat", "sports", 29.99],
        ["Coffee Maker", "home", 64.99],
        ["Desk Lamp", "home", 24.99],
        ["JavaScript Handbook", "books", 39.95],
        ["CSS Design Guide", "books", 27.5]
      ].forEach(([name, category, price]) => {
        insert.run(name, category, price);
      });

      insert.finalize();
    }
  });
});

app.get("/api/products", (req, res) => {
  const { category, minPrice, maxPrice } = req.query;

  const conditions = [];
  const values = [];

  if (category && String(category).trim() !== "") {
    conditions.push("category = ?");
    values.push(String(category).trim());
  }

  if (minPrice !== undefined && String(minPrice).trim() !== "") {
    const parsedMinPrice = Number(minPrice);

    if (!Number.isFinite(parsedMinPrice) || parsedMinPrice < 0) {
      return res.status(400).json({ error: "minPrice must be a non-negative number." });
    }

    conditions.push("price >= ?");
    values.push(parsedMinPrice);
  }

  if (maxPrice !== undefined && String(maxPrice).trim() !== "") {
    const parsedMaxPrice = Number(maxPrice);

    if (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0) {
      return res.status(400).json({ error: "maxPrice must be a non-negative number." });
    }

    conditions.push("price <= ?");
    values.push(parsedMaxPrice);
  }

  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    String(minPrice).trim() !== "" &&
    String(maxPrice).trim() !== "" &&
    Number(minPrice) > Number(maxPrice)
  ) {
    return res.status(400).json({ error: "minPrice cannot be greater than maxPrice." });
  }

  const sql = `
    SELECT id, name, category, price
    FROM products
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY name ASC
  `;

  db.all(sql, values, (error, rows) => {
    if (error) {
      console.error("Product query failed:", error.message);
      return res.status(500).json({ error: "Failed to fetch products." });
    }

    res.json(rows);
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

process.on("SIGINT", () => {
  db.close((error) => {
    if (error) {
      console.error("Failed to close database:", error.message);
      process.exit(1);
    }

    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});