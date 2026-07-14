// commonHeaders.js
/**
 * Express middleware that adds a set of security‑related HTTP headers to every response.
 *
 * Usage:
 *   const express = require('express');
 *   const commonHeaders = require('./commonHeaders');
 *
 *   const app = express();
 *   app.use(commonHeaders);
 *
 * The header list can be extended or overridden by passing an options object:
 *   app.use(commonHeaders({ extraHeaders: { 'X-Custom-Header': 'value' } }));
 */

const DEFAULT_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Click‑jacking protection
  'X-Frame-Options': 'SAMEORIGIN',
  // Basic XSS protection (mostly for older browsers)
  'X-XSS-Protection': '1; mode=block',
  // Enforce HTTPS (adjust maxAge as needed)
  'Strict-Transport-Security':
    'max-age=31536000; includeSubDomains; preload',
  // Control referrer information
  'Referrer-Policy': 'no-referrer-when-downgrade',
  // Default Content Security Policy – can be tightened per app requirements
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'",
  // Prevent caching of sensitive data (adjust for static assets)
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  // Disable MIME type sniffing in older browsers
  Pragma: 'no-cache',
  Expires: '0'
};

/**
 * @param {Object} [options]
 * @param {Object} [options.extraHeaders] - Additional headers to merge with defaults.
 * @param {Array<string>} [options.removeHeaders] - Header names to omit from the default set.
 * @returns {function(req, res, next)} Express middleware
 */
function commonHeaders(options = {}) {
  const {
    extraHeaders = {},
    removeHeaders = []
  } = options;

  // Build final header map once per app start
  const headersToSet = Object.entries(DEFAULT_HEADERS)
    .filter(([name]) => !removeHeaders.includes(name))
    .reduce((acc, [name, value]) => {
      acc[name] = value;
      return acc;
    }, { ...extraHeaders });

  // Middleware function
  return (req, res, next) => {
    for (const [headerName, headerValue] of Object.entries(headersToSet)) {
      // Only set if not already defined by a previous middleware/route handler
      if (!res.getHeader(headerName)) {
        res.setHeader(headerName, headerValue);
      }
    }
    next();
  };
}

module.exports = commonHeaders;