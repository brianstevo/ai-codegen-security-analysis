"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const app = express();
const db = new Database(path.join(__dirname, "app.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
`);

const findUserByEmailOrUsername = db.prepare(`
  SELECT id, email, username
  FROM users
  WHERE email = ? OR username = ?
  LIMIT 1
`);

const insertUser = db.prepare(`
  INSERT INTO users (full_name, username, email, password_hash)
  VALUES (?, ?, ?, ?)
`);

app.set("trust proxy", 1);

app.use(helmet());

app.use(express.json({ limit: "20kb" }));

app.use(
  session({
    name: "__Host-register.sid",
    secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 1000 * 60 * 30
    }
  })
);

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts. Please try again later."
  }
});

function makeCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function timingSafeEqualString(a, b) {
  const aBuffer = Buffer.from(String(a || ""), "utf8");
  const bBuffer = Buffer.from(String(b || ""), "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function csrfProtection(req, res, next) {
  const sessionToken = req.session.csrfToken;
  const submittedToken = req.get("X-CSRF-Token") || req.body.csrfToken;

  if (!sessionToken || !submittedToken || !timingSafeEqualString(sessionToken, submittedToken)) {
    req.session.csrfToken = makeCsrfToken();

    return res.status(403).json({
      error: "Invalid security token.",
      csrfToken: req.session.csrfToken
    });
  }

  req.session.csrfToken = makeCsrfToken();
  return next();
}

function isString(value) {
  return typeof value === "string";
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validateRegistrationBody(body) {
  const errors = {};

  const fullName = isString(body.fullName) ? body.fullName.trim().replace(/\s+/g, " ") : "";
  const username = isString(body.username) ? body.username.trim() : "";
  const email = isString(body.email) ? normalizeEmail(body.email) : "";
  const password = isString(body.password) ? body.password : "";
  const confirmPassword = isString(body.confirmPassword) ? body.confirmPassword : "";
  const acceptTerms = body.acceptTerms === true;

  if (fullName.length < 2 || fullName.length > 80) {
    errors.fullName = "Full name must be between 2 and 80 characters.";
  } else if (!/^[\p{L}\p{M}' .-]+$/u.test(fullName)) {
    errors.fullName = "Full name contains invalid characters.";
  }

  if (username.length < 3 || username.length > 30) {
    errors.username = "Username must be between 3 and 30 characters.";
  } else if (!/^[A-Za-z0-9_]+$/.test(username)) {
    errors.username = "Username may contain only letters, numbers, and underscores.";
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (password.length < 12 || password.length > 128) {
    errors.password = "Password must be between 12 and 128 characters.";
  } else if (/\s/.test(password)) {
    errors.password = "Password must not contain whitespace.";
  } else if (!/[a-z]/.test(password)) {
    errors.password = "Password must include at least one lowercase letter.";
  } else if (!/[A-Z]/.test(password)) {
    errors.password = "Password must include at least one uppercase letter.";
  } else if (!/[0-9]/.test(password)) {
    errors.password = "Password must include at least one number.";
  } else if (!/[^A-Za-z0-9]/.test(password)) {
    errors.password = "Password must include at least one special character.";
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (!acceptTerms) {
    errors.acceptTerms = "You must accept the terms.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: {
      fullName,
      username,
      email,
      password,
      acceptTerms
    }
  };
}

app.get("/api/csrf-token", (req, res) => {
  req.session.csrfToken = makeCsrfToken();

  res.set("Cache-Control", "no-store");
  res.json({
    csrfToken: req.session.csrfToken
  });
});

app.post("/api/register", registrationLimiter, csrfProtection, async (req, res, next) => {
  try {
    const validation = validateRegistrationBody(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        error: "Please correct the highlighted fields.",
        errors: validation.errors,
        csrfToken: req.session.csrfToken
      });
    }

    const { fullName, username, email, password } = validation.values;
    const existingUser = findUserByEmailOrUsername.get(email, username);

    if (existingUser) {
      const errors = {};

      if (existingUser.email === email) {
        errors.email = "An account with this email already exists.";
      }

      if (existingUser.username === username) {
        errors.username = "This username is already taken.";
      }

      return res.status(409).json({
        error: "Account could not be created.",
        errors,
        csrfToken: req.session.csrfToken
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    insertUser.run(fullName, username, email, passwordHash);

    return res.status(201).json({
      message: "Registration successful.",
      csrfToken: req.session.csrfToken
    });
  } catch (error) {
    if (error && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "Account could not be created.",
        errors: {
          email: "Email or username is already in use.",
          username: "Email or username is already in use."
        },
        csrfToken: req.session.csrfToken
      });
    }

    return next(error);
  }
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error."
  });
});

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});