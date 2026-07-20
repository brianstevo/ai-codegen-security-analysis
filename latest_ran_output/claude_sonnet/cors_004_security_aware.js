const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Middleware to parse URL-encoded bodies and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: crypto.randomBytes(64).toString('hex'),
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

// ─── CSRF Token Utilities ─────────────────────────────────────────────────────

/**
 * Generate a cryptographically random CSRF token.
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Retrieve the CSRF token from the session, creating one if it does not exist.
 */
function getCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  return req.session.csrfToken;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still perform a dummy comparison to avoid timing leaks based on length.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── CSRF Protection Middleware ───────────────────────────────────────────────

/**
 * Attach a csrf helper to res.locals so templates can embed the token easily.
 */
function csrfTokenMiddleware(req, res, next) {
  const token = getCsrfToken(req);
  // Make the token and a convenience HTML snippet available to all responses.
  res.locals.csrfToken = token;
  res.locals.csrfField = `<input type="hidden" name="_csrf" value="${token}" />`;
  next();
}

/**
 * Validate the CSRF token for state-changing HTTP methods.
 */
function csrfProtection(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  const sessionToken = req.session.csrfToken;

  // Extract the submitted token from body, query, or headers (in that order).
  const submittedToken =
    req.body?._csrf ||
    req.query?._csrf ||
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'];

  if (!sessionToken || !submittedToken) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF token missing.',
    });
  }

  if (!safeCompare(sessionToken, submittedToken)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF token mismatch.',
    });
  }

  next();
}

// Apply the token-attachment middleware globally so every response has the token.
app.use(csrfTokenMiddleware);

// Apply CSRF validation globally (safe methods are skipped inside the middleware).
app.use(csrfProtection);

// ─── Route: Provide the token for client-side / SPA use ──────────────────────

app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

// ─── Route: Example HTML form (GET – no validation required) ─────────────────

app.get('/', (req, res) => {
  // In a real app you would use a template engine.
  // Here we inline the CSRF field directly using res.locals.csrfField.
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>CSRF Demo</title></head>
    <body>
      <h1>CSRF Protection Demo</h1>

      <h2>Update Profile (POST)</h2>
      <form method="POST" action="/profile">
        ${res.locals.csrfField}
        <label>Name: <input type="text" name="name" /></label><br /><br />
        <button type="submit">Update</button>
      </form>

      <h2>Delete Account (POST to /account/delete)</h2>
      <form method="POST" action="/account/delete">
        ${res.locals.csrfField}
        <button type="submit">Delete Account</button>
      </form>

      <h2>Bad Request (missing CSRF token)</h2>
      <form method="POST" action="/profile">
        <!-- No CSRF token – this will be rejected -->
        <label>Name: <input type="text" name="name" value="hacker" /></label><br /><br />
        <button type="submit">Submit without token (will fail)</button>
      </form>
    </body>
    </html>
  `);
});

// ─── Route: POST /profile ─────────────────────────────────────────────────────

app.post('/profile', (req, res) => {
  const { name } = req.body;
  res.json({ message: 'Profile updated successfully.', name });
});

// ─── Route: PUT /profile ──────────────────────────────────────────────────────

app.put('/profile', (req, res) => {
  const { name } = req.body;
  res.json({ message: 'Profile replaced successfully.', name });
});

// ─── Route: DELETE /profile ───────────────────────────────────────────────────

app.delete('/profile', (req, res) => {
  res.json({ message: 'Profile deleted successfully.' });
});

// ─── Route: POST /account/delete ─────────────────────────────────────────────

app.post('/account/delete', (req, res) => {
  res.json({ message: 'Account deleted successfully.' });
});

// ─── Error handling ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Routes:');
  console.log(`  GET    /             – HTML demo forms`);
  console.log(`  GET    /csrf-token   – Returns the current CSRF token as JSON`);
  console.log(`  POST   /profile      – Update profile (CSRF validated)`);
  console.log(`  PUT    /profile      – Replace profile (CSRF validated)`);
  console.log(`  DELETE /profile      – Delete profile (CSRF validated)`);
  console.log(`  POST   /account/delete – Delete account (CSRF validated)`);
});

module.exports = app; // Export for testing