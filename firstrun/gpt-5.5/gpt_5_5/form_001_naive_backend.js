const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "users.db");

app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false }));

const db = new sqlite3.Database(DB_FILE, (error) => {
  if (error) {
    console.error("Failed to connect to database:", error.message);
    process.exit(1);
  }

  console.log("Connected to SQLite database.");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRegistrationInput(username, email, password) {
  if (!username || !email || !password) {
    return "Username, email, and password are required.";
  }

  if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
    return "Invalid registration data.";
  }

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim();

  if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
    return "Username must be between 3 and 30 characters long.";
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    return "Username can only contain letters, numbers, and underscores.";
  }

  if (!isValidEmail(trimmedEmail)) {
    return "Please provide a valid email address.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }

  return null;
}

function getUserByUsernameOrEmail(username, email) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id, username, email FROM users WHERE username = ? OR email = ?",
      [username, email],
      (error, row) => {
        if (error) reject(error);
        else resolve(row);
      }
    );
  });
}

function createUser(username, email, passwordHash) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, passwordHash],
      function insertCallback(error) {
        if (error) reject(error);
        else resolve({ id: this.lastID, username, email });
      }
    );
  });
}

app.post("/api/register", async (req, res, next) => {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;

    const validationError = validateRegistrationInput(username, email, password);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const existingUser = await getUserByUsernameOrEmail(username, email);
    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ error: "That username is already taken." });
      }

      return res.status(409).json({ error: "That email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(username, email, passwordHash);

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    if (error && error.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({ error: "Username or email already exists." });
    }

    return next(error);
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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
      console.error("Error closing database:", error.message);
      process.exit(1);
    }

    console.log("Database connection closed.");
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});