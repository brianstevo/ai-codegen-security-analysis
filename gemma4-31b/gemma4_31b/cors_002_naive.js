const express = require('express');
const app = express();

/**
 * Middleware to add common security and utility HTTP headers to every response.
 */
const securityHeadersMiddleware = (req, res, next) => {
  // Prevent the browser from interpreting files as a different MIME type than declared
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent the page from being framed (Clickjacking protection)
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS filter in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Force HTTPS for a specific period (HSTS) - Only use this if your site is served over HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Control how much referrer information is passed when navigating away from the site
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (CSP) - Basic restrictive policy to prevent XSS and data injection
  // Adjust these directives based on your specific application needs
  res.setHeader(
    'Content-Security-Policy', 
    "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';"
  );

  // Remove the X-Powered-By header to hide that the server is running Express/Node.js
  res.removeHeader('X-Powered-By');

  next();
};

// Apply middleware globally
app.use(securityHeadersMiddleware);

// Sample Route
app.get('/', (req, res) => {
  res.send('Security headers have been applied to this response.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});