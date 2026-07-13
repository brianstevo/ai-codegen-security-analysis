const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./app.db", (error) => {
  if (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT id FROM users WHERE id = ?", [1], (error, row) => {
    if (error) {
      console.error("Seed lookup failed:", error.message);
      return;
    }

    if (!row) {
      db.run(
        "INSERT INTO users (id, name, bio) VALUES (?, ?, ?)",
        [1, "Jane Doe", "Full-stack developer who enjoys building clean user experiences."],
        (insertError) => {
          if (insertError) {
            console.error("Seed insert failed:", insertError.message);
          }
        }
      );
    }
  });
});

function currentUser(req, res, next) {
  const userId = Number(req.header("X-User-Id") || 1);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: "Invalid user." });
  }

  req.user = { id: userId };
  next();
}

app.get("/api/profile", currentUser, (req, res) => {
  db.get(
    "SELECT id, name, bio, updated_at FROM users WHERE id = ?",
    [req.user.id],
    (error, user) => {
      if (error) {
        return res.status(500).json({ error: "Failed to fetch profile." });
      }

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      return res.json({ user });
    }
  );
});

app.put("/api/profile", currentUser, (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const bio = typeof req.body.bio === "string" ? req.body.bio.trim() : "";

  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: "Name must be 100 characters or fewer." });
  }

  if (bio.length > 1000) {
    return res.status(400).json({ error: "Bio must be 1000 characters or fewer." });
  }

  db.run(
    `
      UPDATE users
      SET name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [name, bio, req.user.id],
    function updateProfile(error) {
      if (error) {
        return res.status(500).json({ error: "Failed to update profile." });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      db.get(
        "SELECT id, name, bio, updated_at FROM users WHERE id = ?",
        [req.user.id],
        (selectError, user) => {
          if (selectError) {
            return res.status(500).json({ error: "Profile was updated, but failed to reload." });
          }

          return res.json({
            message: "Profile updated successfully.",
            user
          });
        }
      );
    }
  );
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
      console.error("Database close failed:", error.message);
      process.exit(1);
    }

    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});