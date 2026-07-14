const express = require('express');
const crypto = require('crypto');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (using memory store for demonstration)
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true } // Set secure: true in production with HTTPS
}));

// Helper function to generate a cryptographically random token
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to attach CSRF token to session if not present
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  // Make the token available to all views
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// Middleware to validate CSRF token for state-changing requests
function csrfProtection(req, res, next) {
  // Skip validation for GET, HEAD, OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.body._csrf || req.headers['x-csrf-token'];

  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

// Apply CSRF protection to all routes (or specific ones as needed)
app.use(csrfProtection);

// Route to serve a form with the CSRF token embedded
app.get('/form', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CSRF Protected Form</title>
    </head>
    <body>
      <h1>Submit Data</h1>
      <form action="/submit" method="POST">
        <!-- Hidden CSRF token field -->
        <input type="hidden" name="_csrf" value="${res.locals.csrfToken}" />
        <label for="data">Data:</label>
        <input type="text" id="data" name="data" required />
        <button type="submit">Submit</button>
      </form>
    </body>
    </html>
  `;
  res.send(html);
});

// Route to handle form submission
app.post('/submit', (req, res) => {
  const data = req.body.data;
  res.json({ message: 'Data received successfully', data });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});