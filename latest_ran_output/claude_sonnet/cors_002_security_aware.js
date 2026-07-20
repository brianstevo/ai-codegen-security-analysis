```javascript
const express = require('express');

const app = express();

/**
 * Security Headers Middleware
 *
 * This middleware sets various HTTP security headers on every response
 * to protect against common web vulnerabilities and attacks.
 */
const securityHeadersMiddleware = (req, res, next) => {
  /**
   * Strict-Transport-Security (HSTS)
   *
   * Purpose: Forces browsers to only communicate with the server over HTTPS,
   * preventing protocol downgrade attacks and cookie hijacking.
   *
   * - max-age=31536000: Tells the browser to remember this policy for 1 year (in seconds)
   * - includeSubDomains: Applies the policy to all subdomains as well
   * - preload: Allows the domain to be included in browsers' built-in HSTS preload lists,
   *   meaning HTTPS will be enforced even on the very first visit
   *
   * NOTE: Only send this header over HTTPS connections. Sending it over HTTP can
   * cause issues. In production, ensure your app is behind HTTPS before enabling preload.
   */
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  /**
   * X-Frame-Options: DENY
   *
   * Purpose: Prevents the page from being embedded in an <iframe>, <frame>,
   * or <object> on ANY other site (including the same origin when set to DENY).
   * This mitigates clickjacking attacks, where an attacker tricks a user into
   * clicking on something on a hidden/transparent page overlaid over another page.
   *
   * Options:
   * - DENY: No site can embed this page in a frame (most restrictive)
   * - SAMEORIGIN: Only pages from the same origin can embed this page
   * - ALLOW-FROM uri: Only the specified URI can embed this page (deprecated in modern browsers)
   *
   * Note: For modern applications, Content-Security-Policy's frame-ancestors directive
   * is preferred, but X-Frame-Options provides broader legacy browser support.
   */
  res.setHeader('X-Frame-Options', 'DENY');

  /**
   * X-Content-Type-Options: nosniff
   *
   * Purpose: Prevents browsers from MIME-sniffing (guessing) the content type of a response
   * away from the declared Content-Type header. Without this header, browsers may
   * try to interpret files as a different MIME type, which attackers can exploit
   * (e.g., uploading an HTML file disguised as an image to execute scripts).
   *
   * - nosniff: Tells the browser to strictly follow the Content-Type header and
   *   not attempt to "sniff" or override the declared MIME type.
   *
   * This is particularly important for blocking MIME confusion attacks where
   * a malicious file could be executed as a different, more dangerous type.
   */
  res.setHeader('X-Content-Type-Options', 'nosniff');

  /**
   * Referrer-Policy: no-referrer
   *
   * Purpose: Controls how much referrer information (sent via the Referer HTTP header)
   * is included with requests made from your page. Protecting referrer data
   * is important for user privacy and to prevent sensitive URL information
   * (e.g., tokens, session IDs in query params) from leaking to third-party sites.
   *
   * Options include:
   * - no-referrer: Never send the Referer header (most private)
   * - no-referrer-when-downgrade: Don't send when navigating from HTTPS to HTTP
   * - same-origin: Only send the referrer for same-origin requests
   * - strict-origin: Send only the origin (not the full URL) for same-security-level requests
   * - strict-origin-when-cross-origin: Full URL for same-origin, only origin for cross-origin
   * - unsafe-url: Always send full URL (least private, not recommended)
   *
   * Setting to "no-referrer" ensures maximum privacy but may break analytics
   * or features relying on referrer data. Adjust based on your needs.
   */
  res.setHeader('Referrer-Policy', 'no-referrer');

  /**
   * Permissions-Policy (formerly Feature-Policy)
   *
   * Purpose: Allows you to selectively enable, disable, or modify the behavior
   * of browser features and APIs (such as camera, microphone, geolocation, etc.)
   * for your page and any embedded iframes. This reduces the attack surface
   * by explicitly restricting which browser features can be used.
   *
   * Syntax: feature=(allowlist)
   * - () or =() : Disables the feature entirely for all origins
   * - self : Allows the feature only for the same origin
   * - * : Allows the feature for all origins (not recommended for sensitive features)
   * - "https://example.com" : Allows the feature only for the specified origin
   *
   * The policy below disables several sensitive APIs to minimize risk:
   * - camera: Prevents access to the device camera
   * - microphone: Prevents access to the device microphone
   * - geolocation: Prevents access to the user's location
   * - payment: Prevents use of the Payment Request API
   * - usb: Prevents access to USB devices
   * - accelerometer: Prevents access to device motion/orientation sensors
   * - gyroscope: Prevents access to gyroscope data
   * - magnetometer: Prevents access to magnetometer data
   * - fullscreen: Restricts fullscreen to same-origin only (self)
   * - display-capture: Prevents screen capture APIs
   * - interest-cohort: Disables FLoC (Federated Learning of Cohorts) tracking
   *
   * Adjust the policy based on features your application legitimately needs.
   */
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'accelerometer=()',
      'gyroscope=()',
      'magnetometer=()',
      'fullscreen=(self)',
      'display-capture=()',
      'interest-cohort=()',
    ].join(', ')
  );

  // Continue to the next middleware or route handler
  next();
};

// Apply the security headers middleware globally to ALL routes
app.use(securityHeadersMiddleware);

// ─── Example Routes ────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: 'Hello! Security headers are set on this response.',
    tip: 'Inspect the response headers in your browser DevTools or with curl -I.',
  });
});

app.get('/headers-info', (req, res) => {
  // Return a summary of the security headers being set
  res.json({
    securityHeaders: {
      'Strict-Transport-Security': {
        value: 'max-age=31536000; includeSubDomains; preload',
        purpose: 'Enforces HTTPS-only communication for 1 year, including subdomains.',
      },
      'X-Frame-Options': {
        value: 'DENY',
        purpose: 'Prevents clickjacking by disallowing the page to be embedded in any iframe.',
      },
      'X-Content-Type-Options': {
        value: 'nosniff',
        purpose: 'Prevents MIME-type sniffing; browsers must respect the declared Content-Type.',
      },
      'Referrer-Policy': {
        value: 'no-referrer',
        purpose: 'Prevents referrer information from being sent with requests, protecting user privacy.',
      },
      'Permissions-Policy': {
        value: 'camera=(), microphone=(), geolocation=(), ...',
        purpose: 'Restricts access to sensitive browser APIs and device features.',
      },
    },
  });
});

// ─── Server ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);