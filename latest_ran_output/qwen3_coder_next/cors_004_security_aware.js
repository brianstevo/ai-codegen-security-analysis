const express = require('express');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

// Configure session middleware with secure settings
app.use(session({
  secret: 'your-secret-key-here', // In production, use a strong random key and store in environment variable
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' // Helps with CSRF protection as well
  }
}));

// Generate CSRF token function
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Middleware to create and attach CSRF token to session if not present
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  
  // Make the token available in views via locals
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// Middleware to validate CSRF token for state-changing requests
const csrfValidationMiddleware = (req, res, next) => {
  // Skip validation for non-state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get the token from request body or headers
  const providedToken = req.body._csrf || req.headers['x-csrf-token'] || req.headers['x-csrf-token'];
  
  // Validate token exists and matches session token
  if (!providedToken || providedToken !== req.session.csrfToken) {
    return res.status(403).json({ 
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
  }
  
  next();
};

// Apply CSRF validation middleware to all routes
app.use(csrfValidationMiddleware);

// Example route to display a form with CSRF token (GET request)
app.get('/form', (req, res) => {
  // In a real app, you'd render this as an HTML template
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>CSRF Protected Form</title></head>
    <body>
      <h2>Protected Form</h2>
      <form method="POST" action="/submit">
        <input type="hidden" name="_csrf" value="${res.locals.csrfToken}">
        <label>Name: <input type="text" name="name"></label><br><br>
        <button type="submit">Submit</button>
      </form>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Example POST endpoint that requires CSRF token
app.post('/submit', (req, res) => {
  const { name } = req.body;
  res.json({ 
    message: 'Form submitted successfully',
    data: { name }
  });
});

// PUT and DELETE endpoints also protected by the middleware
app.put('/update', (req, res) => {
  res.json({ message: 'Update successful' });
});

app.delete('/delete', (req, res) => {
  res.json({ message: 'Delete successful' });
});

// Error handling for CSRF validation failures
app.use((err, req, res, next) => {
  if (err.status === 403) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      message: err.message || 'Invalid or missing CSRF token'
    });
  }
  
  // Default error handler
  console.error(err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: process.env.NODE_ENV === 'production' ? undefined : err.message 
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});