const express = require('express');
const app = express();

/**
 * Security Headers Middleware
 *
 * This middleware sets essential HTTP security headers on every response
 * to protect against common web vulnerabilities and attacks.
 */
const securityHeadersMiddleware = (req, res, next) => {
  /**
   * Strict-Transport-Security (HSTS)
   *
   * Purpose: Forces browsers to only communicate with the server over HTTPS,
   * preventing protocol downgrade attacks and cookie hijacking.
   *
   * - max-age=31536000: Browser will remember to use HTTPS for 1 year (in seconds)
   * - includeSubDomains: Applies the rule to all subdomains as well
   * - preload: Allows the site to be included in browsers' built-in HSTS preload lists,
   *   ensuring HTTPS is enforced even on the first visit
   *
   * Protection against: Man-in-the-middle attacks, SSL stripping attacks
   */
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  /**
   * X-Frame-Options: DENY
   *
   * Purpose: Prevents the page from being embedded in an <iframe>, <frame>,
   * or <object> tag on any other website.
   *
   * - DENY: The page cannot be displayed in a frame, regardless of the site attempting to do so
   * - SAMEORIGIN (alternative): Only allows framing from the same origin
   * - ALLOW-FROM uri (alternative): Only allows framing from a specific URI
   *
   * Protection against: Clickjacking attacks where attackers embed your page
   * in a transparent iframe to trick users into clicking on malicious content
   */
  res.setHeader('X-Frame-Options', 'DENY');

  /**
   * X-Content-Type-Options: nosniff
   *
   * Purpose: Prevents browsers from trying to "sniff" or guess the MIME type
   * of a resource, forcing them to use the declared Content-Type header value.
   *
   * Without this header, browsers may attempt to interpret files differently
   * than declared (e.g., treating a text file as JavaScript).
   *
   * Protection against: MIME-type sniffing attacks, drive-by downloads,
   * and situations where an attacker can control file uploads and trick
   * the browser into executing them as scripts
   */
  res.setHeader('X-Content-Type-Options', 'nosniff');

  /**
   * Referrer-Policy: no-referrer
   *
   * Purpose: Controls how much referrer information (sent via the Referer header)
   * should be included with requests made from your site.
   *
   * - no-referrer: The Referer header will be omitted entirely on all requests
   * - Other options include: strict-origin, same-origin, strict-origin-when-cross-origin, etc.
   *
   * Protection against: Leaking sensitive URL information (like tokens or session IDs
   * in query strings) to third-party services, privacy protection for users,
   * and preventing referrer-based access control bypass attacks
   */
  res.setHeader('Referrer-Policy', 'no-referrer');

  /**
   * Permissions-Policy (formerly Feature-Policy)
   *
   * Purpose: Allows you to control which browser features and APIs can be used
   * in the browser, both in the current page and in embedded iframes.
   *
   * The following directives disable sensitive browser features:
   * - camera=(): Disables access to camera devices
   * - microphone=(): Disables access to microphone devices
   * - geolocation=(): Disables access to the Geolocation API
   * - payment=(): Disables access to the Payment Request API
   * - usb=(): Disables access to USB devices via WebUSB API
   * - fullscreen=(self): Only allows fullscreen requests from the same origin
   * - accelerometer=(): Disables access to accelerometer sensor data
   * - gyroscope=(): Disables access to gyroscope sensor data
   * - magnetometer=(): Disables access to magnetometer sensor data
   * - interest-cohort=(): Opts out of FLoC (Federated Learning of Cohorts) tracking
   *
   * Protection against: Unauthorized access to sensitive device features,
   * privacy violations, and feature abuse by injected third-party scripts
   */
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'fullscreen=(self)',
      'accelerometer=()',
      'gyroscope=()',
      'magnetometer=()',
      'interest-cohort=()',
    ].join(', ')
  );

  /**
   * Additional recommended headers (commented out but available):
   *
   * Content-Security-Policy: Defines approved sources of content that the browser
   * may load, providing deep defense against XSS attacks.
   * Example: res.setHeader('Content-Security-Policy', "default-src 'self'");
   *
   * X-XSS-Protection: Legacy header for older browsers to enable built-in XSS filters.
   * Note: Modern browsers have deprecated this in favor of CSP.
   * Example: res.setHeader('X-XSS-Protection', '1; mode=block');
   *
   * Cross-Origin-Opener-Policy: Prevents other origins from gaining references
   * to your window object.
   * Example: res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
   *
   * Cross-Origin-Resource-Policy: Prevents other websites from loading your resources.
   * Example: res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
   */

  next();
};

// Apply the security middleware globally to all routes
app.use(securityHeadersMiddleware);

// Example route to verify headers are being set
app.get('/', (req, res) => {
  res.json({
    message: 'Security headers are active on this response.',
    hint: 'Check the response headers in your browser DevTools or via curl -I',
  });
});

// Example API route
app.get('/api/data', (req, res) => {
  res.json({
    data: 'This response also includes all security headers.',
    headers: {
      'Strict-Transport-Security': res.getHeader('Strict-Transport-Security'),
      'X-Frame-Options': res.getHeader('X-Frame-Options'),
      'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
      'Referrer-Policy': res.getHeader('Referrer-Policy'),
      'Permissions-Policy': res.getHeader('Permissions-Policy'),
    },
  });
});

// Route to demonstrate that headers are set even on error responses
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'Even 404 responses include the security headers.',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Even error responses include the security headers.',
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Security headers middleware is active.');
  console.log(`Test with: curl -I http://localhost:${PORT}/`);
});

module.exports = { app, securityHeadersMiddleware };