const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');

const app = express();

// --- Basic app setup ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'replace-with-strong-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true behind HTTPS
    },
  })
);

// --- CSRF utilities ---
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function ensureCsrfToken(req, res, next) {
  if (!req.session) return next(new Error('Session middleware required'));
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function csrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  const needsCheck = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (!needsCheck) return next();

  if (!req.session || !req.session.csrfToken) {
    return res.status(403).send('Forbidden: missing CSRF session token');
  }

  const tokenFromBody = req.body && req.body._csrf;
  const tokenFromHeader = req.get('x-csrf-token');
  const providedToken = tokenFromBody || tokenFromHeader;

  if (!providedToken) {
    return res.status(403).send('Forbidden: CSRF token missing');
  }

  if (!timingSafeEqualString(providedToken, req.session.csrfToken)) {
    return res.status(403).send('Forbidden: CSRF token invalid');
  }

  next();
}

// Ensure CSRF token exists for all routes that render forms
app.use(ensureCsrfToken);

// Validate token on state-changing requests
app.use(csrfProtection);

// --- Demo routes ---
app.get('/', (req, res) => {
  res.type('html').send(`
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>CSRF Demo</title></head>
  <body>
    <h1>CSRF Protected Forms</h1>

    <h2>POST Form</h2>
    <form method="POST" action="/profile">
      <input type="hidden" name="_csrf" value="${res.locals.csrfToken}" />
      <label>Name: <input type="text" name="name" value="Alice" /></label>
      <button type="submit">Save (POST)</button>
    </form>

    <h2>PUT Form (method override via query for demo)</h2>
    <form method="POST" action="/resource?_method=PUT">
      <input type="hidden" name="_csrf" value="${res.locals.csrfToken}" />
      <label>Value: <input type="text" name="value" value="123" /></label>
      <button type="submit">Update (PUT)</button>
    </form>

    <h2>DELETE Form (method override via query for demo)</h2>
    <form method="POST" action="/resource?_method=DELETE">
      <input type="hidden" name="_csrf" value="${res.locals.csrfToken}" />
      <button type="submit">Delete (DELETE)</button>
    </form>
  </body>
</html>
  `);
});

// Simple method override for HTML forms (optional demo support)
app.use((req, res, next) => {
  if (req.method === 'POST' && req.query && req.query._method) {
    req.method = String(req.query._method).toUpperCase();
  }
  next();
});

app.post('/profile', (req, res) => {
  res.json({ ok: true, method: 'POST', name: req.body.name || null });
});

app.put('/resource', (req, res) => {
  res.json({ ok: true, method: 'PUT', value: req.body.value || null });
});

app.delete('/resource', (req, res) => {
  res.json({ ok: true, method: 'DELETE' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});