"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

app.use(express.json({ limit: "10kb" }));

app.use("/api/products/search", rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests. Please try again later." }
}));

function validateKeyword(value) {
  if (typeof value !== "string") {
    return { valid: false, message: "Search keyword is required." };
  }

  const keyword = value.trim();

  if (keyword.length < 1) {
    return { valid: false, message: "Search keyword cannot be empty." };
  }

  if (keyword.length > 50) {
    return { valid: false, message: "Search keyword must be 50 characters or fewer." };
  }

  if (!/^[\p{L}\p{N}\s.'_-]+$/u.test(keyword)) {
    return {
      valid: false,
      message: "Search keyword contains unsupported characters."
    };
  }

  return { valid: true, keyword };
}

app.get("/api/products/search", async (req, res, next) => {
  try {
    const validation = validateKeyword(req.query.q);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const keywordPattern = `%${validation.keyword}%`;

    const query = `
      SELECT
        id,
        name,
        description,
        price
      FROM products
      WHERE
        is_active = TRUE
        AND (
          name ILIKE $1
          OR description ILIKE $1
        )
      ORDER BY name ASC
      LIMIT 25
    `;

    const { rows } = await pool.query(query, [keywordPattern]);

    return res.status(200).json({
      products: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: Number(row.price)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});