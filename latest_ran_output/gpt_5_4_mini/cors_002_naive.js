const express = require('express');

function commonHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Optional cache policy for dynamic responses
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-store');
  }

  next();
}

// Example usage
const app = express();

app.use(commonHeadersMiddleware);

app.get('/', (req, res) => {
  res.send('Hello World');
});

module.exports = commonHeadersMiddleware;