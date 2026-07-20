const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database("./profiles.db");

app.use(cors());
app.use(express.json());

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT id FROM users WHERE id = ?", [1], (error, row) => {
    if (error) {
      console.error("Seed lookup failed:", error);
      return;
    }

    if (!row) {
      db.run(
        "INSERT INTO users (id, name, bio) VALUES (?, ?, ?)",
        [1, "Jane Doe", "Full-stack developer who enjoys building useful web apps."],
        (insertError) => {
          if (insertError) {
            console.error("Seed insert failed:", insertError);
          }
        }
      );
    }
  });
});

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function requireUser(req, res, next) {
  const userId = Number(req.header("X-User-Id"));

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: "Missing or invalid X-User-Id header." });
  }

  req.user = { id: userId };
  next();
}

function validateProfileInput(req, res, next) {
  const { name, bio } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Name is required." });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({ error: "Name must be 100 characters or fewer." });
  }

  if (typeof bio !== "string") {
    return res.status(400).json({ error: "Bio must be a string." });
  }

  if (bio.trim().length > 500) {
    return res.status(400).json({ error: "Bio must be 500 characters or fewer." });
  }

  req.profileInput = {
    name: name.trim(),
    bio: bio.trim()
  };

  next();
}

app.get("/api/profile", requireUser, async (req, res) => {
  try {
    const user = await dbGet(
      "SELECT id, name, bio, created_at, updated_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    res.json({ user });
  } catch (error) {
    console.error("GET /api/profile failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.put("/api/profile", requireUser, validateProfileInput, async (req, res) => {
  try {
    const existingUser = await dbGet("SELECT id FROM users WHERE id = ?", [req.user.id]);

    if (!existingUser) {
      return res.status(404).json({ error: "User profile not found." });
    }

    await dbRun(
      `
        UPDATE users
        SET name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [req.profileInput.name, req.profileInput.bio, req.user.id]
    );

    const updatedUser = await dbGet(
      "SELECT id, name, bio, created_at, updated_at FROM users WHERE id = ?",
      [req.user.id]
    );

    res.json({
      message: "Profile updated successfully.",
      user: updatedUser
    });
  } catch (error) {
    console.error("PUT /api/profile failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error." });
});

process.on("SIGINT", () => {
  db.close((error) => {
    if (error) {
      console.error("Database close failed:", error);
      process.exit(1);
    }

    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});