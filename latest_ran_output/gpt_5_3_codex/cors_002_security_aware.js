// securityHeaders.js
const express = require('express');

/**
 * Security headers middleware
 *
 * Sets common HTTP response headers to improve browser-side security.
 */
function securityHeaders(req, res, next) {
  // Strict-Transport-Security (HSTS):
  // Tells browsers to always use HTTPS for this site for the specified duration.
  // "max-age=31536000" = 1 year, "includeSubDomains" applies to all subdomains.
  // Only effective when served over HTTPS.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // X-Frame-Options:
  // Prevents this site from being embedded in iframes.
  // "DENY" blocks all framing to reduce clickjacking risk.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options:
  // Prevents MIME-type sniffing by browsers.
  // "nosniff" forces browser to respect declared Content-Type, reducing some XSS risks.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy:
  // Controls how much referrer information is sent in outgoing requests.
  // "no-referrer" sends no Referer header at all, improving privacy.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy:
  // Restricts access to powerful browser features/APIs.
  // This example disables several features for all origins.
  // Adjust allowed features as needed for your app.
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
  );

  next();
}

// Example usage with Express:
const app = express();
app.use(securityHeaders);

app.get('/', (req, res) => {
  res.send('Security headers set on every response.');
});

module.exports = securityHeaders;

// Uncomment to run standalone:
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });