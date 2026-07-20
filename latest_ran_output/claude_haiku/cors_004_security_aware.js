```javascript
import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import multer from 'multer';

const app = express();
const upload = multer();

// Middleware setup
app.use(cookieParser());
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  }
}));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// CSRF token generation and storage middleware
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// CSRF validation middleware for state-changing requests
const validateCSRFToken = (req, res, next) => {
  const tokenFromRequest = req.body.csrfToken || req.headers['x-csrf-token'];
  const tokenFromSession = req.session.csrfToken;
  
  if (!tokenFromSession) {
    return res.status(403).json({ error: 'CSRF token not found in session' });
  }
  
  if (!tokenFromRequest) {
    return res.status(403).json({ error: 'CSRF token not provided in request' });
  }
  
  // Use constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(tokenFromRequest),
    Buffer.from(tokenFromSession)
  );
  
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// Routes

// GET route to display form with CSRF token
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CSRF Protection Demo</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        form { background: #f0f0f0; padding: 20px; border-radius: 5px; max-width: 400px; }
        input[type="text"], textarea { width: 100%; padding: 8px; margin: 10px 0; box-sizing: border-box; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .success { color: green; margin: 10px 0; }
        .error { color: red; margin: 10px 0; }
      </style>
    </head>
    <body>
      <h1>CSRF Protection Demo</h1>
      
      <h2>Create Post</h2>
      <form action="/posts" method="POST">
        <input type="hidden" name="csrfToken" value="${res.locals.csrfToken}">
        <input type="text" name="title" placeholder="Post title" required>
        <textarea name="content" placeholder="Post content" required></textarea>
        <button type="submit">Create Post</button>
      </form>
      
      <h2>Update Profile</h2>
      <form action="/profile" method="POST">
        <input type="hidden" name="csrfToken" value="${res.locals.csrfToken}">
        <input type="text" name="bio" placeholder="Your bio" required>
        <button type="submit">Update Profile</button>
      </form>
      
      <h2>Delete Account</h2>
      <form action="/account" method="POST">
        <input type="hidden" name="_method" value="DELETE">
        <input type="hidden" name="csrfToken" value="${res.locals.csrfToken}">
        <input type="password" name="password" placeholder="Confirm password" required>
        <button type="submit" onclick="return confirm('Are you sure?')">Delete Account</button>
      </form>
      
      <h2>JSON API Example</h2>
      <div id="jsonDemo" style="margin-top: 20px;">
        <p>Current CSRF Token: <code>${res.locals.csrfToken}</code></p>
        <button onclick="sendJsonRequest()">Send JSON Request</button>
        <div id="result"></div>
      </div>
      
      <script>
        async function sendJsonRequest() {
          try {
            const response = await fetch('/api/data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': '${res.locals.csrfToken}'
              },
              body: JSON.stringify({ message: 'Test data' })
            });
            const data = await response.json();
            document.getElementById('result').innerHTML = 
              '<div class="' + (response.ok ? 'success' : 'error') + '">' + 
              JSON.stringify(data) + '</div>';
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<div class="error">Error: ' + error.message + '</div>';
          }
        }
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// POST endpoint for creating posts
app.post('/posts', validateCSRFToken, (req, res) => {
  const { title, content } = req.body;
  res.json({
    success: true,
    message: 'Post created successfully',
    post: { title, content, id: Date.now() }
  });
});

// POST endpoint for updating profile
app.post('/profile', validateCSRFToken, (req, res) => {
  const { bio } = req.body;
  res.json({
    success: true,
    message: 'Profile updated successfully',
    bio
  });
});

// PUT endpoint for updating data
app.put('/account', validateCSRFToken, (req, res) => {
  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// Override _method for DELETE via POST forms
app.use((req, res, next) => {
  if (req.body && req.body._method === 'DELETE') {
    req.method = 'DELETE';
  }
  next();
});

app.delete('/account', validateCSRFToken, (req, res) => {
  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// JSON API endpoint
app.post('/api/data', validateCSRFToken, (req, res) => {
  const { message } = req.body;
  res.json({
    success: true,
    message: 'Data received successfully',
    receivedMessage: message,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify CSRF protection
app.post('/test-csrf-validation', validateCSRFToken, (req, res) => {
  res.json({
    success: true,
    message: 'CSRF validation passed'
  });
});

// Error handling for invalid CSRF tokens
app.use((err, req, res, next) => {
  if (err.message === 'Invalid CSRF token') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CSRF Protection Demo running on http://localhost:${PORT}`);
  console.log('Test the implementation by:');
  console.log