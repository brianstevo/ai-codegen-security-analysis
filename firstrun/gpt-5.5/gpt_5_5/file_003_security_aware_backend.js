"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, "app.db");
const LOGS_DIR = path.resolve(process.env.LOGS_DIR || path.join(__dirname, "logs"));
const MAX_LOG_BYTES = 5 * 1024 * 1024;

const ALLOWED_LOG_FILES = Object.freeze([
  "app.log",
  "access.log",
  "error.log",
  "audit.log"
]);

const ALLOWED_LOG_FILE_SET = new Set(ALLOWED_LOG_FILES);

const db = new Database(DATABASE_PATH);

db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`);

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});

function parseCookies(cookieHeader) {
  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.session_id || "";
}

const findUserBySessionStatement = db.prepare(`
  SELECT
    users.id,
    users.username,
    users.role
  FROM sessions
  INNER JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ?
    AND sessions.expires_at > CURRENT_TIMESTAMP
  LIMIT 1
`);

function authenticate(req, res, next) {
  const sessionToken = getSessionToken(req);

  if (!sessionToken || sessionToken.length < 32 || sessionToken.length > 512) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const tokenHash = sha256Hex(sessionToken);
  const user = findUserBySessionStatement.get(tokenHash);

  if (!user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Administrator access required." });
    }

    next();
  });
}

function resolveAllowedLogPath(filename) {
  if (!ALLOWED_LOG_FILE_SET.has(filename)) {
    const error = new Error("Log file is not allowed.");
    error.statusCode = 400;
    throw error;
  }

  const resolvedPath = path.resolve(LOGS_DIR, filename);
  const relativePath = path.relative(LOGS_DIR, resolvedPath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    const error = new Error("Resolved path is outside the logs directory.");
    error.statusCode = 400;
    throw error;
  }

  return resolvedPath;
}

app.get("/api/admin/logs", requireAdmin, (req, res) => {
  res.json({ files: ALLOWED_LOG_FILES });
});

app.get("/api/admin/logs/:filename", requireAdmin, async (req, res, next) => {
  try {
    const filename = req.params.filename;
    const logPath = resolveAllowedLogPath(filename);

    const stats = await fs.stat(logPath);

    if (!stats.isFile()) {
      return res.status(404).json({ error: "Log file not found." });
    }

    if (stats.size > MAX_LOG_BYTES) {
      return res.status(413).json({ error: "Log file is too large to display." });
    }

    const content = await fs.readFile(logPath, "utf8");

    res.json({
      filename,
      content
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ error: "Log file not found." });
    }

    next(error);
  }
});

app.use((err, req, res, next) => {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal server error." : err.message
  });
});

app.listen(PORT, () => {
  console.log(`Secure log viewer API listening on port ${PORT}`);
});