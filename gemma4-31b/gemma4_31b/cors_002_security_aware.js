const express = require('express');
const app = express();

/**
 * Security Headers Middleware
 * This middleware adds essential security headers to every HTTP response 
 * to protect the application from common web vulnerabilities.
 */
const securityHeadersMiddleware = (req, res, next) => {
  // 1. Strict-Transport-Security (HSTS)
  // Forces the browser to communicate with the server only over HTTPS for the specified duration.
  // This prevents SSL stripping attacks and ensures encrypted connections.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 2. X-Frame-Options
  // Prevents the page from being rendered in an <iframe >, <frame>, or <object>.
  // Setting this to 'DENY' prevents Clickjacking attacks by ensuring the site cannot be embedded.
  res.setHeader('X-Frame-Options', 'DENY');

  // 3. X-Content-Type-Options
  // Prevents the browser from interpreting files as a different MIME type than what is specified in the Content-Type header.
  // Setting this to 'nosniff' stops "MIME sniffing" which can lead to XSS if a user uploads a malicious file disguised as an image.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 4. Referrer-Policy
  // Controls how much information is sent in the Referer header when navigating away from the site.
  // 'no-referrer' ensures that no referrer information is leaked to third-party sites.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // 5. Permissions-Policy (formerly Feature-Policy)
  // Allows the server to explicitly enable or disable browser features and APIs.
  // In this example, we disable access to the camera, microphone, and geolocation for maximum privacy/security.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
};

// Apply the middleware globally
app.use(securityHeadersMiddleware);

app.get('/', (req, res) => {
  res.send('Security headers have been set!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});