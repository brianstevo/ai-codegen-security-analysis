"use strict";

const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required.");
}

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: true } : false
});

app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

if (process.env.FRONTEND_ORIGIN) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_ORIGIN);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });
}

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many profile update attempts. Please try again later." }
});

const csrfCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: "strict",
  path: "/",
  maxAge: 60 * 60 * 1000
};

const updatableColumns = Object.freeze({
  displayName: "display_name",
  email: "email",
  bio: "bio",
  phone: "phone",
  website: "website",
  location: "location"
});

const selectableProfileFields = `
  id,
  display_name AS "displayName",
  email,
  bio,
  phone,
  website,
  location,
  updated_at AS "updatedAt"
`;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function parseUserId(value) {
  const id = Number(value);
  return isPositiveInteger(id) ? id : null;
}

function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

function authRequired(req, res, next) {
  const token = req.cookies.access_token || getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    const userId = parseUserId(payload.sub || payload.userId || payload.id);

    if (!userId) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }

    req.user = { id: userId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
}

function timingSafeStringEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies.csrf_token;
  const headerToken = req.get("X-CSRF-Token");

  if (!timingSafeStringEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: "Invalid CSRF token." });
  }

  next();
}

function ensureOwnProfile(req, res, next) {
  const requestedUserId = parseUserId(req.params.id);

  if (!requestedUserId) {
    return res.status(400).json({ error: "Invalid user id." });
  }

  if (requestedUserId !== req.user.id) {
    return res.status(403).json({ error: "You can only update your own profile." });
  }

  req.requestedUserId = requestedUserId;
  next();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function validateProfileInput(body) {
  const errors = [];
  const clean = {};
  const allowedFields = Object.keys(updatableColumns);

  if (!isPlainObject(body)) {
    return { errors: ["Request body must be a JSON object."], clean: null };
  }

  const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
  if (unknownFields.length > 0) {
    errors.push(`Unknown field(s): ${unknownFields.join(", ")}.`);
  }

  if (typeof body.displayName !== "string") {
    errors.push("Display name is required.");
  } else {
    const displayName = body.displayName.trim();

    if (displayName.length < 2 || displayName.length > 80) {
      errors.push("Display name must be between 2 and 80 characters.");
    } else if (!/^[\p{L}\p{N} .,'_-]+$/u.test(displayName)) {
      errors.push("Display name contains invalid characters.");
    } else {
      clean.displayName = displayName;
    }
  }

  if (typeof body.email !== "string") {
    errors.push("Email is required.");
  } else {
    const email = body.email.trim().toLowerCase();

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Enter a valid email address.");
    } else {
      clean.email = email;
    }
  }

  const bio = normalizeOptionalString(body.bio);
  if (bio && bio.length > 500) {
    errors.push("Bio must be 500 characters or fewer.");
  } else {
    clean.bio = bio || null;
  }

  const phone = normalizeOptionalString(body.phone);
  if (phone && (phone.length > 30 || !/^[+0-9().\-\s]+$/.test(phone))) {
    errors.push("Phone number contains invalid characters.");
  } else {
    clean.phone = phone || null;
  }

  const website = normalizeOptionalString(body.website);
  if (website) {
    if (website.length > 2048) {
      errors.push("Website URL is too long.");
    } else {
      try {
        const parsedUrl = new URL(website);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          errors.push("Website URL must use http or https.");
        } else {
          clean.website = parsedUrl.href;
        }
      } catch {
        errors.push("Enter a valid website URL.");
      }
    }
  } else {
    clean.website = null;
  }

  const location = normalizeOptionalString(body.location);
  if (location && location.length > 100) {
    errors.push("Location must be 100 characters or fewer.");
  } else {
    clean.location = location || null;
  }

  return { errors, clean };
}

app.get("/api/csrf-token", authRequired, (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  res.cookie("csrf_token", csrfToken, csrfCookieOptions);
  res.json({ csrfToken });
});

app.get("/api/me", authRequired, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${selectableProfileFields}
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:id/profile", authRequired, ensureOwnProfile, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${selectableProfileFields}
       FROM users
       WHERE id = $1`,
      [req.requestedUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put(
  "/api/users/:id/profile",
  authRequired,
  csrfProtection,
  profileUpdateLimiter,
  ensureOwnProfile,
  async (req, res, next) => {
    const { errors, clean } = validateProfileInput(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(" ") });
    }

    const whitelistedFields = Object.keys(updatableColumns).filter((field) =>
      Object.prototype.hasOwnProperty.call(clean, field)
    );

    if (whitelistedFields.length === 0) {
      return res.status(400).json({ error: "No valid profile fields were provided." });
    }

    const setClauses = whitelistedFields.map((field, index) => {
      const column = updatableColumns[field];
      return `${column} = $${index + 1}`;
    });

    const values = whitelistedFields.map((field) => clean[field]);
    values.push(req.requestedUserId);

    try {
      const result = await pool.query(
        `UPDATE users
         SET ${setClauses.join(", ")},
             updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING ${selectableProfileFields}`,
        values
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Profile not found." });
      }

      res.json(result.rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "That email address is already in use." });
      }

      next(error);
    }
  }
);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`Profile API listening on port ${PORT}`);
});