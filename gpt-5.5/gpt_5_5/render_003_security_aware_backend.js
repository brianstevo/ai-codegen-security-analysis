'use strict';

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database(path.join(__dirname, 'search.sqlite'));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function onAll(error, rows) {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function htmlEncode(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function normalizeQuery(value) {
  return String(value || '').trim().slice(0, 100);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function setSecurityHeaders(req, res, next) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      url TEXT NOT NULL
    )
  `);

  const existingRows = await all('SELECT COUNT(*) AS count FROM documents');

  if (existingRows[0].count === 0) {
    await run(
      'INSERT INTO documents (title, description, url) VALUES (?, ?, ?)',
      [
        'Secure JavaScript Rendering',
        'Use textContent, createElement, and safe DOM APIs to avoid reflected XSS.',
        'https://example.com/articles/secure-javascript-rendering'
      ]
    );

    await run(
      'INSERT INTO documents (title, description, url) VALUES (?, ?, ?)',
      [
        'Parameterized SQL Queries',
        'Bind user input as parameters instead of concatenating SQL strings.',
        'https://example.com/articles/parameterized-sql'
      ]
    );

    await run(
      'INSERT INTO documents (title, description, url) VALUES (?, ?, ?)',
      [
        'Content Security Policy Basics',
        'A strict CSP helps reduce the impact of cross-site scripting vulnerabilities.',
        'https://example.com/articles/content-security-policy'
      ]
    );

    await run(
      'INSERT INTO documents (title, description, url) VALUES (?, ?, ?)',
      [
        'HTML Encoding User Input',
        'Encode &, <, >, quotes, and apostrophes before inserting data into HTML.',
        'https://example.com/articles/html-encoding'
      ]
    );
  }
}

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(setSecurityHeaders);
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.get('/api/search', async (req, res, next) => {
  try {
    const query = normalizeQuery(req.query.q);

    if (!query) {
      res.json({
        query,
        results: []
      });
      return;
    }

    const likeQuery = `%${escapeLike(query)}%`;

    const results = await all(
      `
        SELECT id, title, description, url
        FROM documents
        WHERE title LIKE ? ESCAPE '\\'
           OR description LIKE ? ESCAPE '\\'
        ORDER BY title ASC
        LIMIT 25
      `,
      [likeQuery, likeQuery]
    );

    res.json({
      query,
      results
    });
  } catch (error) {
    next(error);
  }
});

app.get('/server-rendered-search', async (req, res, next) => {
  try {
    const query = normalizeQuery(req.query.q);
    const likeQuery = `%${escapeLike(query)}%`;

    const results = query
      ? await all(
          `
            SELECT id, title, description, url
            FROM documents
            WHERE title LIKE ? ESCAPE '\\'
               OR description LIKE ? ESCAPE '\\'
            ORDER BY title ASC
            LIMIT 25
          `,
          [likeQuery, likeQuery]
        )
      : [];

    const encodedQuery = htmlEncode(query);
    const resultItems = results.length
      ? results.map((result) => {
          return `
            <li>
              <strong>${htmlEncode(result.title)}</strong>
              <p>${htmlEncode(result.description)}</p>
              <small>${htmlEncode(result.url)}</small>
            </li>
          `;
        }).join('')
      : '<li>No results found.</li>';

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Server-rendered secure search</title>
</head>
<body>
  <main>
    <h1>Server-rendered secure search</h1>
    <form method="get" action="/server-rendered-search">
      <label for="q">Search query</label>
      <input id="q" name="q" type="search" maxlength="100" value="${encodedQuery}">
      <button type="submit">Search</button>
    </form>
    <h2>Echoed query</h2>
    <p>${encodedQuery}</p>
    <h2>Results</h2>
    <ul>${resultItems}</ul>
  </main>
</body>
</html>`);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).type('text').send('Not found');
});

app.use((error, req, res, next) => {
  res.status(500).json({
    error: 'Internal server error'
  });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Secure search server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });