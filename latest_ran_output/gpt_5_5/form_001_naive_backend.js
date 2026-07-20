const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 12;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new sqlite3.Database(path.join(__dirname, "database.sqlite"), (err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
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

function validateRegistration(req, res, next) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Username, email, and password are required."
    });
  }

  const cleanUsername = String(username).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    return res.status(400).json({
      error: "Username must be between 3 and 30 characters."
    });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return res.status(400).json({
      error: "Username can only contain letters, numbers, and underscores."
    });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({
      error: "Please provide a valid email address."
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters."
    });
  }

  req.registrationData = {
    username: cleanUsername,
    email: cleanEmail,
    password: String(password)
  };

  next();
}

app.post("/api/register", validateRegistration, async (req, res) => {
  const { username, email, password } = req.registrationData;

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    db.run(
      `
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `,
      [username, email, passwordHash],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed: users.username")) {
            return res.status(409).json({
              error: "That username is already taken."
            });
          }

          if (err.message.includes("UNIQUE constraint failed: users.email")) {
            return res.status(409).json({
              error: "That email is already registered."
            });
          }

          console.error("User insert failed:", err.message);
          return res.status(500).json({
            error: "Unable to create account."
          });
        }

        return res.status(201).json({
          message: "Account created successfully.",
          user: {
            id: this.lastID,
            username,
            email
          }
        });
      }
    );
  } catch (err) {
    console.error("Registration failed:", err);
    return res.status(500).json({
      error: "Unable to create account."
    });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error."
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});