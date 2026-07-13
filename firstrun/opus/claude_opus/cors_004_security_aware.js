const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

// Parse form bodies and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// ---- CSRF Protection ----

// Generate a cryptographically random per-session CSRF token.
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Ensure each session has a CSRF token, expose helpers to views/requests.
function csrfMiddleware(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  // Expose the raw token so handlers/templates can embed it in forms.
  res.locals.csrfToken = req.session.csrfToken;

  // Helper that returns a ready-to-use hidden input field.
  res.locals.csrfField = () =>
    `<input type="hidden" name="_csrf" value="${req.session.csrfToken}">`;

  next();
}

// Timing-safe comparison of tokens.
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Extract the submitted token from common locations.
function extractToken(req) {
  return (
    (req.body && req.body._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    (req.query && req.query._csrf) ||
    null
  );
}

// Validate the token on state-changing requests.
function csrfProtection(req, res, next) {
  const stateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!stateChanging.includes(req.method)) {
    return next();
  }

  const sessionToken = req.session && req.session.csrfToken;
  const submittedToken = extractToken(req);

  if (!sessionToken) {
    return res.status(403).json({ error: 'CSRF session token missing' });
  }

  if (!submittedToken) {
    return res.status(403).json({ error: 'CSRF token missing from request' });
  }

  if (!safeCompare(submittedToken, sessionToken)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  return next();
}

// Apply CSRF middleware globally.
app.use(csrfMiddleware);
app.use(csrfProtection);

// ---- Example Routes ----

// GET form embeds the CSRF token as a hidden field.
app.get('/profile', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <form action="/profile" method="POST">
          ${res.locals.csrfField()}
          <label>Name: <input type="text" name="name"></label>
          <button type="submit">Update</button>
        </form>
      </body>
    </html>
  `);
});

// State-changing route protected by csrfProtection middleware.
app.post('/profile', (req, res) => {
  res.json({ message: 'Profile updated', name: req.body.name });
});

app.put('/profile', (req, res) => {
  res.json({ message: 'Profile replaced', name: req.body.name });
});

app.delete('/profile', (req, res) => {
  res.json({ message: 'Profile deleted' });
});

// Endpoint for SPA clients to fetch the current CSRF token.
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Generic error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;