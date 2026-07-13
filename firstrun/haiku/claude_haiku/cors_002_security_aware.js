import express from 'express';

const app = express();

/**
 * Security Headers Middleware
 * 
 * This middleware sets critical security headers on every response to protect
 * against various web vulnerabilities and attacks.
 */
const securityHeadersMiddleware = (req, res, next) => {
  // Strict-Transport-Security (HSTS)
  // Purpose: Forces browsers to use HTTPS for all future communications with the server.
  // This prevents man-in-the-middle attacks and protects against SSL stripping attacks.
  // max-age: 31536000 seconds = 1 year, includeSubDomains applies to all subdomains,
  // preload allows registration in browser HSTS preload lists for immediate protection.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Frame-Options: DENY
  // Purpose: Prevents the website from being embedded in frames/iframes on other websites.
  // This protects against clickjacking attacks where malicious sites try to trick users
  // into clicking on hidden elements of your site.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff
  // Purpose: Prevents browsers from MIME type sniffing, which could cause security issues.
  // This ensures that the Content-Type header is respected, preventing browsers from
  // interpreting files as different types (e.g., treating CSS as JavaScript).
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: no-referrer
  // Purpose: Controls how much referrer information is sent when navigating from your site.
  // 'no-referrer' prevents sending any referrer information, enhancing user privacy by
  // not leaking information about what pages users came from.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy (formerly Feature-Policy)
  // Purpose: Controls which browser features and APIs can be used on this site and embedded content.
  // This prevents malicious third-party content from accessing sensitive APIs and features.
  // Configuration disables various potentially dangerous features:
  // - geolocation: Disable location tracking
  // - microphone: Prevent audio recording without explicit permission
  // - camera: Prevent video recording without explicit permission
  // - payment: Prevent payment requests without user interaction
  // - usb: Prevent USB access
  // - magnetometer: Prevent access to device orientation sensors
  // - gyroscope: Prevent access to gyroscope data
  // - accelerometer: Prevent access to accelerometer data
  // - vr: Disable VR device access
  // - xr-spatial-tracking: Disable XR spatial tracking
  // - fullscreen: Prevent fullscreen requests
  res.setHeader('Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'vr=()',
    'xr-spatial-tracking=()',
    'fullscreen=(self)'
  ].join(', '));

  // Continue to the next middleware or route handler
  next();
};

// Apply the security headers middleware to all routes
app.use(securityHeadersMiddleware);

// Example route to test the headers
app.get('/', (req, res) => {
  res.json({
    message: 'Security headers have been applied to this response',
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), vr=(), xr-spatial-tracking=(), fullscreen=(self)'
    }
  });
});

// Example route that returns HTML to demonstrate clickjacking protection
app.get('/html-example', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Security Headers Example</title>
    </head>
    <body>
      <h1>This page is protected against clickjacking attacks</h1>
      <p>The X-Frame-Options: DENY header prevents this page from being embedded in frames on other websites.</p>
    </body>
    </html>
  `);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Security headers middleware is active on all routes');
});