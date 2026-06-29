```javascript
const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware Setup ────────────────────────────────────────────────────────

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// ─── CSRF Token Utilities ────────────────────────────────────────────────────

/**
 * Generate a cryptographically random CSRF token and store it in the session.
 * Returns the existing token if one already exists for this session.
 */
function generateCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Rotate the CSRF token – call this after a successful state-changing request
 * to implement token-per-request semantics (optional but more secure).
 */
function rotateCsrfToken(req) {
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

/**
 * Validate the submitted CSRF token against the session token.
 * Uses a timing-safe comparison to prevent timing attacks.
 */
function validateCsrfToken(req) {
  const sessionToken = req.session.csrfToken;
  if (!sessionToken) return false;

  // Token can come from a form field, a custom header, or the JSON body.
  const submittedToken =
    (req.body && req.body._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'];

  if (!submittedToken) return false;

  // Ensure both buffers are the same length before comparing to avoid
  // crypto.timingSafeEqual throwing on length mismatch.
  const sessionBuf = Buffer.from(sessionToken);
  const submittedBuf = Buffer.from(submittedToken);

  if (sessionBuf.length !== submittedBuf.length) return false;

  return crypto.timingSafeEqual(sessionBuf, submittedBuf);
}

// ─── CSRF Middleware ─────────────────────────────────────────────────────────

/**
 * Ensure every session has a CSRF token and expose helpers on `res.locals`
 * so templates can render the hidden field easily.
 */
function csrfTokenMiddleware(req, res, next) {
  const token = generateCsrfToken(req);

  // Make the token available to template engines via res.locals.
  res.locals.csrfToken = token;
  res.locals.csrfField = `<input type="hidden" name="_csrf" value="${token}">`;

  // Attach a convenience getter to the request object.
  req.csrfToken = () => token;

  next();
}

/**
 * Enforce CSRF validation for all state-changing HTTP methods.
 */
function csrfProtectionMiddleware(req, res, next) {
  const statefulMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!statefulMethods.includes(req.method)) {
    return next();
  }

  if (!validateCsrfToken(req)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing CSRF token.',
    });
  }

  next();
}

// Register both middleware globally.
app.use(csrfTokenMiddleware);
app.use(csrfProtectionMiddleware);

// ─── Simple In-Memory "Database" ─────────────────────────────────────────────

const items = new Map();
let nextId = 1;

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /csrf-token
 * Returns the current CSRF token as JSON (useful for SPA / fetch-based clients).
 */
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

/**
 * GET /
 * Render a simple HTML page that demonstrates embedded CSRF hidden fields.
 */
app.get('/', (req, res) => {
  const itemRows = [...items.values()]
    .map(
      (item) => `
        <tr>
          <td>${item.id}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>
            <!-- DELETE form with CSRF token -->
            <form method="POST" action="/items/${item.id}/delete" style="display:inline">
              ${res.locals.csrfField}
              <button type="submit">Delete</button>
            </form>
            <!-- Edit form trigger (inline for demo) -->
            <form method="POST" action="/items/${item.id}" style="display:inline">
              ${res.locals.csrfField}
              <input type="hidden" name="_method" value="PUT">
              <input name="name" value="${escapeHtml(item.name)}" required>
              <button type="submit">Update</button>
            </form>
          </td>
        </tr>`
    )
    .join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSRF Demo</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    th { background: #f4f4f4; }
    .error { color: red; }
    .success { color: green; }
    code { background: #eee; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>CSRF Protection Demo</h1>

  <h2>Current CSRF Token</h2>
  <p>Session token: <code>${res.locals.csrfToken}</code></p>
  <p>This token is embedded as a hidden field in every form below.</p>

  <h2>Add Item</h2>
  <!-- POST form – includes the CSRF hidden field -->
  <form method="POST" action="/items">
    ${res.locals.csrfField}
    <label>
      Item name:
      <input type="text" name="name" required placeholder="Enter item name">
    </label>
    <button type="submit">Add</button>
  </form>

  <h2>Items</h2>
  ${
    items.size === 0
      ? '<p>No items yet.</p>'
      : `<table>
           <thead><tr><th>ID</th><th>Name</th><th>Actions</th></tr></thead>
           <tbody>${itemRows}</tbody>
         </table>`
  }

  <hr>
  <h2>Test: Forged Request (no token)</h2>
  <form method="POST" action="/items">
    <!-- Intentionally omitting the CSRF field to demonstrate rejection -->
    <input type="text" name="name" value="Forged item">
    <button type