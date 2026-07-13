"use strict";

const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(64).toString("hex");
const BCRYPT_COST = 12;

const db = new sqlite3.Database(process.env.SQLITE_DB_PATH || "./app.db");

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function onGet(error, row) {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

async function initializeDatabase() {
  await dbRun("PRAGMA foreign_keys = ON");
  await dbRun("PRAGMA journal_mode = WAL");

  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      username_normalized TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      email_normalized TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function generateCsrfToken(req) {
  const token = crypto.randomBytes(32).toString("base64url");
  req.session.csrfToken = token;
  return token;
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function requireCsrfToken(req, res, next) {
  const sessionToken = req.session.csrfToken;
  const submittedToken = req.body && req.body.csrfToken;

  if (!sessionToken || !submittedToken || !safeEqual(sessionToken, submittedToken)) {
    const csrfToken = generateCsrfToken(req);
    return res.status(403).json({
      message: "Invalid CSRF token.",
      csrfToken
    });
  }

  next();
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  if (email.length < 3 || email.length > 254) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePasswordComplexity(password) {
  const errors = [];

  if (typeof password !== "string") {
    return ["Password is required."];
  }

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters.");
  }

  if (password.length > 128) {
    errors.push("Password must be no more than 128 characters.");
  }

  if (/\s/.test(password)) {
    errors.push("Password must not contain whitespace.");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter.");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must include at least one number.");
  }

  if (!/[^A-Za-z0-9\s]/.test(password)) {
    errors.push("Password must include at least one symbol.");
  }

  return errors;
}

function validateRegistrationFields(body) {
  const errors = [];

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!/^[A-Za-z0-9_-]{3,30}$/.test(username)) {
    errors.push("Username must be 3–30 characters and contain only letters, numbers, underscores, or hyphens.");
  }

  if (!isValidEmail(email)) {
    errors.push("Email address is invalid.");
  }

  errors.push(...validatePasswordComplexity(password));

  if (password !== confirmPassword) {
    errors.push("Passwords do not match.");
  }

  return {
    errors,
    values: {
      username,
      usernameNormalized: username.toLowerCase(),
      email,
      emailNormalized: email.toLowerCase(),
      password
    }
  };
}

app.set("trust proxy", 1);

app.use(helmet());

app.use(express.json({
  limit: "20kb",
  strict: true
}));

app.use(session({
  name: "__Host-registration.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 1000 * 60 * 30
  }
}));

const csrfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts. Please try again later."
  }
});

app.get("/api/csrf-token", csrfLimiter, (req, res) => {
  const csrfToken = generateCsrfToken(req);
  res.json({ csrfToken });
});

app.post("/api/register", registrationLimiter, requireCsrfToken, async (req, res) => {
  const { errors, values } = validateRegistrationFields(req.body);

  if (errors.length > 0) {
    const csrfToken = generateCsrfToken(req);
    return res.status(400).json({
      message: "Validation failed.",
      errors,
      csrfToken
    });
  }

  try {
    const existingUser = await dbGet(
      `
        SELECT id
        FROM users
        WHERE username_normalized = ?
           OR email_normalized = ?
        LIMIT 1
      `,
      [values.usernameNormalized, values.emailNormalized]
    );

    if (existingUser) {
      const csrfToken = generateCsrfToken(req);
      return res.status(409).json({
        message: "Registration failed.",
        errors: ["Username or email is already registered."],
        csrfToken
      });
    }

    const passwordHash = await bcrypt.hash(values.password, BCRYPT_COST);

    await dbRun(
      `
        INSERT INTO users (
          username,
          username_normalized,
          email,
          email_normalized,
          password_hash
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        values.username,
        values.usernameNormalized,
        values.email,
        values.emailNormalized,
        passwordHash
      ]
    );

    generateCsrfToken(req);

    return res.status(201).json({
      message: "Registration successful."
    });
  } catch (error) {
    if (error && error.code === "SQLITE_CONSTRAINT") {
      const csrfToken = generateCsrfToken(req);
      return res.status(409).json({
        message: "Registration failed.",
        errors: ["Username or email is already registered."],
        csrfToken
      });
    }

    return res.status(500).json({
      message: "Internal server error."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    message: "Not found."
  });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      message: "Invalid JSON."
    });
  }

  return res.status(500).json({
    message: "Internal server error."
  });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });