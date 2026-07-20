const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

// Parse form and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware (required to store the per-session CSRF token)
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // requires HTTPS in production
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// --- CSRF helpers ---

// Generate a cryptographically random token
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Constant-time comparison to prevent timing attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Ensure every session has a CSRF token and expose it to views/handlers
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  // Make the token available to templates / handlers
  res.locals.csrfToken = req.session.csrfToken;

  // Helper to render a hidden field for embedding in forms
  res.locals.csrfField = () =>
    `<input type="hidden" name="_csrf" value="${req.session.csrfToken}">`;

  next();
});

// CSRF validation middleware for state-changing methods
const PROTECTED_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

function csrfProtection(req, res, next) {
  if (!PROTECTED_METHODS.has(req.method)) {
    return next();
  }

  const sessionToken = req.session && req.session.csrfToken;

  // Accept the token from body, query, or common headers
  const submittedToken =
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    req.get('x-csrf-token') ||
    req.get('x-xsrf-token');

  if (!sessionToken) {
    return res.status(403).json({ error: 'CSRF token missing from session.' });
  }

  if (!submittedToken) {
    return res.status(403).json({ error: 'CSRF token missing from request.' });
  }

  if (!safeCompare(submittedToken, sessionToken)) {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }

  return next();
}

app.use(csrfProtection);

// --- Example routes ---

// A form that embeds the CSRF token as a hidden field
app.get('/form', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <form action="/submit" method="POST">
          ${res.locals.csrfField()}
          <label>Name: <input type="text" name="name"></label>
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

// State-changing route protected by CSRF validation
app.post('/submit', (req, res) => {
  res.json({ message: 'Form accepted', data: { name: req.body.name } });
});

app.put('/resource/:id', (req, res) => {
  res.json({ message: `Resource ${req.params.id} updated` });
});

app.delete('/resource/:id', (req, res) => {
  res.json({ message: `Resource ${req.params.id} deleted` });
});

// Endpoint to fetch the token for AJAX/SPA clients
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;