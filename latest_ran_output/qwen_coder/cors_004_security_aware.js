const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to generate and set CSRF token on session
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// Middleware to validate CSRF token for POST/PUT/DELETE requests
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const csrfTokenFromForm = req.body._csrf;
    const csrfTokenFromSession = req.session.csrfToken;

    if (!csrfTokenFromForm || csrfTokenFromForm !== csrfTokenFromSession) {
      return res.status(403).send('CSRF token mismatch');
    }
  }
  next();
});

// Example route with CSRF protection
app.post('/submit', (req, res) => {
  // Handle form submission
  res.send('Form submitted successfully');
});

// Start server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});