const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');

const app = express();

// ----- Basic app/session setup -----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'replace-with-a-strong-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true behind HTTPS
      maxAge: 1000 * 60 * 60,
    },
  })
);

// ----- CSRF utilities -----
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  return req.session.csrfToken;
}

// Make csrfToken available to templates/routes
app.use((req, res, next) => {
  res.locals.csrfToken = ensureCsrfToken(req);
  next();
});

// Constant-time comparison helper
function safeEqual(a, b) {
  try {
    const aBuf = Buffer.from(String(a), 'utf8');
    const bBuf = Buffer.from(String(b), 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// Validate CSRF for state-changing methods
function csrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return next();
  }

  const sentToken =
    req.body?._csrf ||
    req.headers['x-csrf-token'] ||
    req.query?._csrf;

  const sessionToken = req.session?.csrfToken;

  if (!sentToken || !sessionToken || !safeEqual(sentToken, sessionToken)) {
    return res.status(403).send('Forbidden: invalid or missing CSRF token');
  }

  next();
}

app.use(csrfProtection);

// ----- Demo routes -----
app.get('/', (req, res) => {
  const csrf = res.locals.csrfToken;
  res.type('html').send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>CSRF Demo</title>
</head>
<body>
  <h1>CSRF Protected Forms</h1>

  <h2>POST Form</h2>
  <form method="POST" action="/profile">
    <input type="hidden" name="_csrf" value="${csrf}" />
    <label>
      Display Name:
      <input type="text" name="displayName" />
    </label>
    <button type="submit">Save (POST)</button>
  </form>

  <h2>PUT Form (via method override field interpreted by route)</h2>
  <form method="POST" action="/account">
    <input type="hidden" name="_csrf" value="${csrf}" />
    <input type="hidden" name="_method" value="PUT" />
    <label>
      Email:
      <input type="email" name="email" />
    </label>
    <button type="submit">Update (PUT)</button>
  </form>

  <h2>DELETE Form (via method override field interpreted by route)</h2>
  <form method="POST" action="/account/delete">
    <input type="hidden" name="_csrf" value="${csrf}" />
    <button type="submit">Delete Account (DELETE endpoint demo)</button>
  </form>
</body>
</html>
  `);
});

// POST endpoint
app.post('/profile', (req, res) => {
  res.json({
    ok: true,
    message: 'Profile updated via POST',
    data: { displayName: req.body.displayName || null },
  });
});

// Simple PUT-like behavior through POST + _method for HTML form demo
app.post('/account', (req, res, next) => {
  if ((req.body._method || '').toUpperCase() === 'PUT') {
    return res.json({
      ok: true,
      message: 'Account updated via PUT-style form',
      data: { email: req.body.email || null },
    });
  }
  return res.status(405).send('Method Not Allowed');
});

// Real PUT endpoint (for API clients)
app.put('/account', (req, res) => {
  res.json({
    ok: true,
    message: 'Account updated via PUT',
    data: { email: req.body.email || null },
  });
});

// DELETE demo via POST route (HTML forms) and real DELETE route
app.post('/account/delete', (req, res) => {
  res.json({ ok: true, message: 'Account deleted (POST form demo)' });
});

app.delete('/account', (req, res) => {
  res.json({ ok: true, message: 'Account deleted via DELETE' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});