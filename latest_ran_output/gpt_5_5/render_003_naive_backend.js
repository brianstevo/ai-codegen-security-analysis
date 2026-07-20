const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(path.join(__dirname, "search.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM articles", (err, row) => {
    if (err) {
      console.error("Database count error:", err);
      return;
    }

    if (row.count === 0) {
      const insert = db.prepare(`
        INSERT INTO articles (title, description)
        VALUES (?, ?)
      `);

      [
        [
          "Getting Started with JavaScript",
          "Learn the fundamentals of JavaScript, including variables, functions, arrays, and objects."
        ],
        [
          "Building APIs with Express",
          "Create fast and simple HTTP APIs using Node.js and the Express framework."
        ],
        [
          "Understanding SQL Search",
          "Use SQL LIKE queries and parameterized statements to safely find matching database records."
        ],
        [
          "Frontend Fetch Examples",
          "Send requests from browser JavaScript to backend services using the Fetch API."
        ],
        [
          "Full-Stack Search Page",
          "Combine an HTML search form, JavaScript rendering, an Express route, and a database query."
        ],
        [
          "Node.js Middleware Basics",
          "Understand how Express middleware handles JSON parsing, logging, static files, and errors."
        ]
      ].forEach(([title, description]) => {
        insert.run(title, description);
      });

      insert.finalize();
    }
  });
});

app.get("/api/search", (req, res, next) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.json({
      query,
      results: []
    });
  }

  const searchTerm = `%${query}%`;

  db.all(
    `
      SELECT id, title, description
      FROM articles
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY title ASC
      LIMIT 25
    `,
    [searchTerm, searchTerm],
    (err, rows) => {
      if (err) {
        return next(err);
      }

      res.json({
        query,
        results: rows
      });
    }
  );
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  db.close(() => {
    process.exit(0);
  });
});