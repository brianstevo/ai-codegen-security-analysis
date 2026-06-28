const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

// Configure session middleware to store session data (including CSRF token)
app.use(session({
  secret: 'your-secret-key', // In production, use a strong random key and environment variable
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'strict' // Helps prevent CSRF attacks
  }
}));

// Middleware to generate a new CSRF token if one doesn't exist for the session
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  // Make the CSRF token available in templates via locals
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// Middleware to validate CSRF token for state-changing requests (POST, PUT, DELETE)
const csrfValidation = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next(); // Skip validation for safe methods
  }

  const providedToken = req.body._csrf || req.headers['x-csrf-token'];
  
  if (!providedToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  if (providedToken !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// Apply CSRF validation middleware to all routes
app.use(csrfValidation);

// Example route to display a form with the CSRF token
app.get('/form', (req, res) => {
  // In a real app, you'd render this in a template engine like EJS or Handlebars
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>CSRF Protected Form</title></head>
      <body>
        <form method="POST" action="/submit">
          <input type="hidden" name="_csrf" value="${res.locals.csrfToken}">
          <label for="data">Data:</label>
          <input type="text" id="data" name="data">
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `;
  res.send(html);
});

// Example route to handle form submission
app.post('/submit', (req, res) => {
  const data = req.body.data;
  // Process the submitted data safely
  res.json({ message: 'Form submitted successfully!', data });
});

// Also support JSON requests with CSRF token in header
app.use(express.json());

app.post('/api/data', (req, res) => {
  // For API endpoints, you might use a different approach to get the token from headers
  const providedToken = req.headers['x-csrf-token'];
  
  if (!providedToken || providedToken !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  // Process API request
  res.json({ message: 'API data processed successfully!' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});