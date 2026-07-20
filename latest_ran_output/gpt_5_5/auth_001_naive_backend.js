const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_FILE = process.env.DATABASE_FILE || "app.db";

const db = new Database(DATABASE_FILE);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const demoPasswordHash = bcrypt.hashSync("password123", 12);

db.prepare(`
  INSERT OR IGNORE INTO users (username, password_hash)
  VALUES (?, ?)
`).run("demo", demoPasswordHash);

app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running." });
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.trim() === "" ||
      password === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    const normalizedUsername = username.trim();

    const user = db.prepare(`
      SELECT id, username, password_hash
      FROM users
      WHERE username = ?
      LIMIT 1
    `).get(normalizedUsername);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    return res.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});