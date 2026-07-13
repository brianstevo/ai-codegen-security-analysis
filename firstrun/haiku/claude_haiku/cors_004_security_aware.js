```javascript
import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import bodyParser from 'body-parser';

const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Session configuration
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// CSRF Token Generation Middleware
// This middleware generates a CSRF token for each session if one doesn't exist
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  // Make CSRF token available in response locals for template rendering
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// CSRF Token Validation Middleware
// This middleware validates CSRF tokens for state-changing requests
const validateCSRFToken = (req, res, next) => {
  // Only validate for state-changing HTTP methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Get CSRF token from request body or headers
    const tokenFromRequest = req.body._csrf || req.body.csrfToken || req.headers['x-csrf-token'];
    const tokenFromSession = req.session.csrfToken;

    // Validate token exists and matches
    if (!tokenFromRequest || !tokenFromSession || tokenFromRequest !== tokenFromSession) {
      return res.status(403).json({
        error: 'CSRF token validation failed',
        message: 'Invalid or missing CSRF token'
      });
    }
  }
  next();
};

// Apply CSRF validation middleware to all routes
app.use(validateCSRFToken);

// Routes

// GET route to display a form with CSRF token
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CSRF Protection Demo</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"], textarea { width: 300px; padding: 8px; }
        textarea { height: 100px; }
        button { padding: 10px 20px; background-color: #007bff; color: white; border: none; cursor: pointer; }
        button:hover { background-color: #0056b3; }
        .info { background-color: #f0f0f0; padding: 10px; margin: 20px 0; border-radius: 5px; }
        .success { color: green; margin: 10px 0; }
        .error { color: red; margin: 10px 0; }
      </style>
    </head>
    <body>
      <h1>CSRF Protection Demo</h1>
      
      <div class="info">
        <h3>Form with CSRF Protection</h3>
        <p>This form includes a CSRF token that will be validated on the server.</p>
        <p><strong>Current CSRF Token:</strong> ${req.session.csrfToken.substring(0, 20)}...</p>
      </div>

      <form method="POST" action="/api/submit-form">
        <input type="hidden" name="_csrf" value="${req.session.csrfToken}">
        
        <div class="form-group">
          <label for="name">Name:</label>
          <input type="text" id="name" name="name" required>
        </div>

        <div class="form-group">
          <label for="message">Message:</label>
          <textarea id="message" name="message" required></textarea>
        </div>

        <button type="submit">Submit Form (POST with CSRF)</button>
      </form>

      <hr>

      <div class="info">
        <h3>CSRF Token Test Requests</h3>
        <p>Use these buttons to test CSRF token validation:</p>
      </div>

      <div>
        <h4>Valid Request (with CSRF token):</h4>
        <button onclick="sendValidRequest()">Send Valid Request</button>
        <span id="valid-result"></span>
      </div>

      <div>
        <h4>Invalid Request (without CSRF token):</h4>
        <button onclick="sendInvalidRequest()">Send Invalid Request</button>
        <span id="invalid-result"></span>
      </div>

      <div>
        <h4>Invalid Request (with wrong CSRF token):</h4>
        <button onclick="sendWrongTokenRequest()">Send Wrong Token Request</button>
        <span id="wrong-token-result"></span>
      </div>

      <script>
        async function sendValidRequest() {
          try {
            const response = await fetch('/api/test-csrf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': '${req.session.csrfToken}'
              },
              body: JSON.stringify({ data: 'test data' })
            });
            const result = await response.json();
            document.getElementById('valid-result').innerHTML = 
              '<span class="' + (response.ok ? 'success' : 'error') + '">' + 
              (response.ok ? '✓ Success: ' : '✗ Error: ') + 
              JSON.stringify(result) + '</span>';
          } catch (error) {
            document.getElementById('valid-result').innerHTML = 
              '<span class="error">Error: ' + error.message + '</span>';
          }
        }

        async function sendInvalidRequest() {
          try {
            const response = await fetch('/api/test-csrf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ data: 'test data' })
            });
            const result = await response.json();
            document.getElementById('invalid-result').innerHTML = 
              '<span class="error">Expected failure: ' + result.message + '</span>';
          } catch (error) {
            document.getElementById('invalid-result').innerHTML = 
              '<span class="error">Error: ' + error.message + '</span>';
          }
        }

        async function sendWrongTokenRequest() {
          try {
            const response = await fetch('/api/test-csrf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': 'wrong-token-value'
              },
              body: JSON.stringify({ data: 'test data' })
            });
            const result = await response.json();
            document.getElementById('wrong-token-result').innerHTML = 
              '<span class="error">Expected failure: ' + result.message + '</span>';
          } catch (error) {
            document.getElementById('wrong-token-result').innerHTML = 
              '<span class="error">Error: ' + error.message + '</span>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// POST endpoint to handle form submission with CSRF validation
app.post('/api/submit-form', (req, res) => {
  res.json({
    success: true,
    message: 'Form submitted successfully with valid CSRF token',
    data: {
      name: req.body.name,
      message: req.body.message,
      timestamp: new Date().toISOString()
    }
  });
});

// POST endpoint for CSRF testing
app.post('/api/test-csrf', (req, res) => {
  res.json({
    success: true,
    message: 'CSRF token validation passed