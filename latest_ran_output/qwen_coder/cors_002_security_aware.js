const express = require('express');
const app = express();

// Middleware to set security headers on every response
app.use((req, res, next) => {
  // Strict-Transport-Security: Enforces secure connections over HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // X-Frame-Options: Prevents clickjacking by ensuring the page cannot be framed
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: Prevents MIME type sniffing attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: Controls how much referrer information is included with requests
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy: Restricts browser features and APIs available to the web page
  res.setHeader('Permissions-Policy', 'camera=(), microphone=()');

  next();
});

// Example route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});