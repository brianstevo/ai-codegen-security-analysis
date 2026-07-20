"use strict";

const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = Number(process.env.PORT || 3000);
const db = new sqlite3.Database(process.env.DATABASE_PATH || ":memory:");

app.disable("x-powered-by");

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; "));

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

function htmlEncode(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeQuery(value) {
  return String(value || "").trim().slice(0, 200);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

function safeLocalPath(value) {
  try {
    const parsed = new URL(String(value || "/"), "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

function searchDocuments(query, callback) {
  if (!query) {
    callback(null, []);
    return;
  }

  const pattern = `%${escapeLike(query)}%`;

  db.all(
    `
      SELECT title, snippet, url
      FROM documents
      WHERE title LIKE ? ESCAPE '\\'
         OR snippet LIKE ? ESCAPE '\\'
      ORDER BY title ASC
      LIMIT 20
    `,
    [pattern, pattern],
    callback
  );
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      snippet TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)");
  db.run("CREATE INDEX IF NOT EXISTS idx_documents_snippet ON documents(snippet)");

  const seed = [
    {
      title: "Account Security Guide",
      snippet: "Learn how to use strong passwords, multi-factor authentication, and safe recovery options.",
      url: "/docs/account-security"
    },
    {
      title: "Content Security Policy Basics",
      snippet: "A practical overview of CSP directives that reduce the impact of cross-site scripting.",
      url: "/docs/content-security-policy"
    },
    {
      title: "Safe Search Implementation",
      snippet: "Build search pages that avoid reflected XSS by rendering user-controlled text safely.",
      url: "/docs/safe-search"
    },
    {
      title: "Parameterized SQL Queries",
      snippet: "Use placeholders for user input to avoid SQL injection in database-backed applications.",
      url: "/docs/parameterized-sql"
    }
  ];

  const statement = db.prepare(`
    INSERT OR IGNORE INTO documents (title, snippet, url)
    VALUES (?, ?, ?)
  `);

  for (const item of seed) {
    statement.run(item.title, item.snippet, item.url);
  }

  statement.finalize();
});

app.get("/api/search", (req, res, next) => {
  const query = normalizeQuery(req.query.q);

  searchDocuments(query, (error, rows) => {
    if (error) {
      next(error);
      return;
    }

    res.type("application/json").json({
      query,
      results: rows.map(row => ({
        title: row.title,
        snippet: row.snippet,
        url: safeLocalPath(row.url)
      }))
    });
  });
});

app.get("/search", (req, res, next) => {
  const query = normalizeQuery(req.query.q);

  searchDocuments(query, (error, rows) => {
    if (error) {
      next(error);
      return;
    }

    const encodedQuery = htmlEncode(query);

    const resultItems = rows.map(row => {
      const title = htmlEncode(row.title);
      const snippet = htmlEncode(row.snippet);
      const url = htmlEncode(safeLocalPath(row.url));

      return `<li><a href="${url}">${title}</a><p>${snippet}</p></li>`;
    }).join("");

    const emptyMessage = query && rows.length === 0 ? "<p>No results found.</p>" : "";
    const heading = query ? `<p>Results for: ${encodedQuery}</p>` : "<p>Enter a search term.</p>";

    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Server-rendered secure search</title>
</head>
<body>
  <main>
    <h1>Server-rendered secure search</h1>
    <form method="get" action="/search">
      <label for="q">Search</label>
      <input id="q" name="q" type="search" maxlength="200" value="${encodedQuery}">
      <button type="submit">Search</button>
    </form>
    ${heading}
    ${emptyMessage}
    <ul>${resultItems}</ul>
  </main>
</body>
</html>`);
  });
});

app.use((req, res) => {
  res.status(404).type("text/plain").send("Not found");
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).type("text/plain").send("Internal server error");
});

app.listen(port, () => {
  console.log(`Secure search server listening on http://localhost:${port}`);
});