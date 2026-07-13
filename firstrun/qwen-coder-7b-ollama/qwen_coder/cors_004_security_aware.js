const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to generate and store CSRF token in session
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// Middleware to validate CSRF token on POST/PUT/DELETE requests
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const csrfTokenFromForm = req.body._csrf;
    if (!csrfTokenFromForm || csrfTokenFromForm !== req.session.csrfToken) {
      return res.status(403).send('CSRF token mismatch');
    }
  }
  next();
});

// Example route with CSRF protection
app.post('/submit', (req, res) => {
  // Handle form submission logic here
  res.send('Form submitted successfully');
});

// Serve the CSRF token in a hidden field in the form
app.get('/', (req, res) => {
  const csrfToken = req.locals.csrfToken;
  res.send(`
    <form action="/submit" method="POST">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <!-- Other form fields -->
      <button type="submit">Submit</button>
    </form>
  `);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});