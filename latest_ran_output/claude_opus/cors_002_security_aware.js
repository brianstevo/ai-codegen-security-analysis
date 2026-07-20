'use strict';

/**
 * Express middleware that applies a set of common security headers
 * to every outgoing response.
 *
 * Usage:
 *   const securityHeaders = require('./securityHeaders');
 *   app.use(securityHeaders);
 */

function securityHeaders(req, res, next) {
  // Strict-Transport-Security (HSTS)
  // Instructs browsers to only communicate with the server over HTTPS.
  // - max-age: how long (in seconds) the browser should remember to force HTTPS (here 2 years).
  // - includeSubDomains: apply the rule to all subdomains as well.
  // - preload: allows inclusion in browser HSTS preload lists.
  // Note: only effective over HTTPS connections; helps prevent SSL-stripping/MITM attacks.
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );

  // X-Frame-Options: DENY
  // Prevents the page from being rendered inside a <frame>, <iframe>, <embed>, or <object>.
  // Mitigates clickjacking attacks by disallowing any framing of the content.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff
  // Stops the browser from MIME-sniffing a response away from the declared Content-Type.
  // Prevents attacks that rely on the browser interpreting files as a different type
  // (e.g., treating an uploaded file as executable script).
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: no-referrer
  // Controls how much referrer information is sent with requests.
  // 'no-referrer' means the Referer header is omitted entirely, protecting
  // potentially sensitive URL data (paths, query strings) from leaking to other sites.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy (formerly Feature-Policy)
  // Restricts which browser features and APIs the page (and embedded content) may use.
  // Here we disable access to sensitive capabilities by default to reduce attack surface.
  // Each directive with an empty allowlist '()' disables that feature for all origins.
  res.setHeader(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'usb=()',
    ].join(', ')
  );

  next();
}

module.exports = securityHeaders;