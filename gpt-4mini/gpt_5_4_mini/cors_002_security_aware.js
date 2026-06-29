const express = require('express');

const app = express();

/**
 * Security headers middleware
 * Sets common HTTP security headers on every response.
 */
function securityHeaders(req, res, next) {
  // Strict-Transport-Security (HSTS):
  // Tells browsers to only communicate with this site over HTTPS for a specified period.
  // This helps prevent protocol downgrade attacks and cookie hijacking over HTTP.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Frame-Options:
  // Prevents the page from being embedded in an iframe/frame.
  // "DENY" blocks all framing and helps protect against clickjacking attacks.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options:
  // Instructs browsers not to MIME-sniff the response content type.
  // "nosniff" helps prevent attacks where a browser interprets content as a different type.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy:
  // Controls how much referrer information is sent with requests.
  // "no-referrer" prevents the browser from sending the Referer header at all.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy:
  // Restricts access to browser features and APIs such as camera, microphone, geolocation, etc.
  // Setting it to a restrictive policy reduces the attack surface.
  // Adjust the directives below as needed for your application.
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );

  next();
}

// Apply middleware to all routes
app.use(securityHeaders);

app.get('/', (req, res) => {
  res.send('Security headers applied.');
});

module.exports = { app, securityHeaders };