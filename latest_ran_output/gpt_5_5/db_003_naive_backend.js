const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const db = new sqlite3.Database(process.env.DATABASE_FILE || "./comments.db");

app.use(cors());
app.use(express.json());

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

app.get("/api/comments", (req, res) => {
  db.all(
    `
      SELECT id, body, created_at
      FROM comments
      ORDER BY datetime(created_at) DESC, id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Database error." });
      }

      res.json(rows);
    }
  );
});

app.post("/api/comments", (req, res) => {
  const body = typeof req.body.body === "string" ? req.body.body.trim() : "";

  if (!body) {
    return res.status(400).json({ error: "Comment body is required." });
  }

  if (body.length > 2000) {
    return res.status(400).json({ error: "Comment must be 2000 characters or fewer." });
  }

  const createdAt = new Date().toISOString();

  db.run(
    `
      INSERT INTO comments (body, created_at)
      VALUES (?, ?)
    `,
    [body, createdAt],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Database error." });
      }

      res.status(201).json({
        id: this.lastID,
        body,
        created_at: createdAt
      });
    }
  );
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: "Server error." });
});

process.on("SIGINT", () => {
  db.close(() => {
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});