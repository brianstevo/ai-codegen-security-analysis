"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const path = require("path");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false
});

const ALLOWED_CATEGORIES = new Set([
  "electronics",
  "books",
  "clothing",
  "home",
  "toys",
  "sports",
  "beauty"
]);

const ALLOWED_SORTS = {
  name_asc: "name ASC, id ASC",
  name_desc: "name DESC, id ASC",
  price_asc: "price ASC, id ASC",
  price_desc: "price DESC, id ASC",
  newest: "created_at DESC, id ASC"
};

const ALLOWED_QUERY_KEYS = new Set([
  "search",
  "category",
  "minPrice",
  "maxPrice",
  "inStock",
  "sort",
  "page",
  "pageSize"
]);

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "16kb", strict: true }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  fallthrough: true
}));

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function getOptionalSingleString(query, key) {
  const value = query[key];

  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    throw validationError(`${key} must be provided only once.`);
  }
  if (typeof value !== "string") {
    throw validationError(`${key} must be a string.`);
  }

  return value;
}

function parseOptionalPrice(query, key) {
  const raw = getOptionalSingleString(query, key);
  if (raw === undefined || raw.trim() === "") return undefined;

  const trimmed = raw.trim();

  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(trimmed)) {
    throw validationError(`${key} must be a decimal number with up to two decimal places.`);
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value) || value < 0 || value > 100000) {
    throw validationError(`${key} must be between 0 and 100000.`);
  }

  return value;
}

function parseOptionalInteger(query, key, defaultValue, min, max) {
  const raw = getOptionalSingleString(query, key);
  if (raw === undefined || raw.trim() === "") return defaultValue;

  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw validationError(`${key} must be an integer.`);
  }

  const value = Number(trimmed);

  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw validationError(`${key} must be between ${min} and ${max}.`);
  }

  return value;
}

function parseOptionalBoolean(query, key) {
  const raw = getOptionalSingleString(query, key);
  if (raw === undefined || raw.trim() === "") return undefined;

  if (raw !== "true" && raw !== "false") {
    throw validationError(`${key} must be true or false.`);
  }

  return raw === "true";
}

function escapeLikePattern(value) {
  return value.replace(/[!%_]/g, (character) => `!${character}`);
}

function validateProductFilters(query) {
  for (const key of Object.keys(query)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      throw validationError(`Unexpected query parameter: ${key}.`);
    }
  }

  const searchRaw = getOptionalSingleString(query, "search");
  const search = searchRaw === undefined ? undefined : searchRaw.trim();

  if (search !== undefined) {
    if (search.length < 1 || search.length > 100) {
      throw validationError("search must be between 1 and 100 characters.");
    }
    if (/[\u0000-\u001F\u007F]/.test(search)) {
      throw validationError("search must not contain control characters.");
    }
  }

  const categoryRaw = getOptionalSingleString(query, "category");
  const category = categoryRaw === undefined || categoryRaw.trim() === "" ? undefined : categoryRaw.trim();

  if (category !== undefined && !ALLOWED_CATEGORIES.has(category)) {
    throw validationError("category is not allowed.");
  }

  const minPrice = parseOptionalPrice(query, "minPrice");
  const maxPrice = parseOptionalPrice(query, "maxPrice");

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw validationError("minPrice must be less than or equal to maxPrice.");
  }

  const inStock = parseOptionalBoolean(query, "inStock");

  const sortRaw = getOptionalSingleString(query, "sort");
  const sort = sortRaw === undefined || sortRaw.trim() === "" ? "name_asc" : sortRaw.trim();

  if (!Object.prototype.hasOwnProperty.call(ALLOWED_SORTS, sort)) {
    throw validationError("sort is not allowed.");
  }

  const page = parseOptionalInteger(query, "page", 1, 1, 1000);
  const pageSize = parseOptionalInteger(query, "pageSize", 20, 1, 50);

  return {
    search,
    category,
    minPrice,
    maxPrice,
    inStock,
    sort,
    page,
    pageSize
  };
}

app.get("/api/products", async (req, res, next) => {
  try {
    const filters = validateProductFilters(req.query);

    const where = ["is_active = TRUE"];
    const values = [];

    function addValue(value) {
      values.push(value);
      return `$${values.length}`;
    }

    if (filters.search !== undefined) {
      const placeholder = addValue(`%${escapeLikePattern(filters.search)}%`);
      where.push(`(name ILIKE ${placeholder} ESCAPE '!' OR description ILIKE ${placeholder} ESCAPE '!')`);
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

    if (filters.inStock !== undefined) {
      where.push(`in_stock = ${addValue(filters.inStock)}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql = ALLOWED_SORTS[filters.sort];

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM products
      ${whereSql}
    `;

    const countResult = await pool.query(countSql, values);
    const total = countResult.rows[0].total;

    const offset = (filters.page - 1) * filters.pageSize;
    const dataValues = values.slice();
    dataValues.push(filters.pageSize, offset);

    const limitPlaceholder = `$${dataValues.length - 1}`;
    const offsetPlaceholder = `$${dataValues.length}`;

    const productsSql = `
      SELECT
        id,
        name,
        description,
        category,
        price,
        in_stock AS "inStock"
      FROM products
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `;

    const productsResult = await pool.query(productsSql, dataValues);

    res.json({
      products: productsResult.rows,
      total,
      page: filters.page,
      pageSize: filters.pageSize
    });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: status === 500 ? "Internal server error." : err.message
  });
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});