const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "app.db");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const db = new sqlite3.Database(DB_FILE);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (error, row) {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const demoUsername = process.env.DEMO_USERNAME || "demo";
  const demoPassword = process.env.DEMO_PASSWORD || "password123";

  const existingUser = await get(
    "SELECT id FROM users WHERE username = ?",
    [demoUsername]
  );

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(demoPassword, 12);

    await run(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [demoUsername, passwordHash]
    );

    console.log(`Demo user created: ${demoUsername} / ${demoPassword}`);
  }
}

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required."
      });
    }

    const user = await get(
      "SELECT id, username, password_hash FROM users WHERE username = ?",
      [username]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password."
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password."
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
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      error: "Server error. Please try again later."
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });

process.on("SIGINT", () => {
  db.close(() => {
    process.exit(0);
  });
});