const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

const db = new sqlite3.Database(process.env.DB_FILE || ":memory:");

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS search_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      snippet TEXT NOT NULL
    )
  `);

  const existingRows = await all(`SELECT COUNT(*) AS count FROM search_results`);

  if (existingRows[0].count > 0) {
    return;
  }

  const seedData = [
    {
      title: "Getting Started with Node.js",
      url: "https://example.com/node-getting-started",
      snippet: "Learn how to build fast backend APIs with Node.js, npm, and JavaScript."
    },
    {
      title: "Express Routing Guide",
      url: "https://example.com/express-routing",
      snippet: "A practical guide to creating routes, middleware, and JSON APIs with Express."
    },
    {
      title: "Vanilla JavaScript Fetch Tutorial",
      url: "https://example.com/javascript-fetch",
      snippet: "Use the Fetch API to send requests, receive JSON, and update the DOM."
    },
    {
      title: "SQLite Search Basics",
      url: "https://example.com/sqlite-search",
      snippet: "Store searchable records in SQLite and query them safely with parameters."
    },
    {
      title: "Building Search Results Pages",
      url: "https://example.com/search-results-pages",
      snippet: "Design a search UI that displays returned results, counts, and echoed queries."
    },
    {
      title: "Frontend Forms with HTML",
      url: "https://example.com/html-forms",
      snippet: "Create accessible forms with labels, inputs, buttons, and browser validation."
    },
    {
      title: "API Error Handling",
      url: "https://example.com/api-error-handling",
      snippet: "Return useful HTTP status codes and JSON error messages from backend services."
    }
  ];

  for (const item of seedData) {
    await run(
      `
        INSERT INTO search_results (title, url, snippet)
        VALUES (?, ?, ?)
      `,
      [item.title, item.url, item.snippet]
    );
  }
}

function escapeLikeWildcards(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

app.get("/api/search", async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!query) {
      return res.status(400).json({
        error: "Query parameter q is required."
      });
    }

    if (query.length > 100) {
      return res.status(400).json({
        error: "Query parameter q must be 100 characters or fewer."
      });
    }

    const likeQuery = `%${escapeLikeWildcards(query)}%`;

    const results = await all(
      `
        SELECT id, title, url, snippet
        FROM search_results
        WHERE title LIKE ? ESCAPE '\\'
           OR snippet LIKE ? ESCAPE '\\'
           OR url LIKE ? ESCAPE '\\'
        ORDER BY
          CASE
            WHEN title LIKE ? ESCAPE '\\' THEN 0
            WHEN snippet LIKE ? ESCAPE '\\' THEN 1
            ELSE 2
          END,
          title ASC
        LIMIT 25
      `,
      [likeQuery, likeQuery, likeQuery, likeQuery, likeQuery]
    );

    return res.json({
      query,
      count: results.length,
      results
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found."
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: "Internal server error."
  });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Search API listening on http://localhost:${PORT}`);
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