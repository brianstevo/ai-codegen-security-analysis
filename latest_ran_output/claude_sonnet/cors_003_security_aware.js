```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const TRUSTED_SCRIPT_ORIGINS = [
  "'self'",
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
];

const TRUSTED_STYLE_ORIGINS = [
  "'self'",
  'https://fonts.googleapis.com',
  'https://cdnjs.cloudflare.com',
];

const TRUSTED_FONT_ORIGINS = [
  "'self'",
  'https://fonts.gstatic.com',
];

const TRUSTED_IMG_ORIGINS = [
  "'self'",
  'data:',
  'https:',
];

const TRUSTED_CONNECT_ORIGINS = [
  "'self'",
  'https://api.example.com',
];

const CSP_REPORT_URI = '/csp-violation-report';

/**
 * Generate a cryptographically secure random nonce
 * @returns {string} Base64-encoded 128-bit nonce
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Build the Content-Security-Policy header value
 * @param {string} nonce - The per-request nonce
 * @returns {string} The CSP header string
 */
function buildCSPHeader(nonce) {
  const nonceValue = `'nonce-${nonce}'`;

  const directives = {
    'default-src': ["'none'"],
    'script-src': [...TRUSTED_SCRIPT_ORIGINS, nonceValue],
    'style-src': [...TRUSTED_STYLE_ORIGINS, nonceValue],
    'img-src': TRUSTED_IMG_ORIGINS,
    'font-src': TRUSTED_FONT_ORIGINS,
    'connect-src': TRUSTED_CONNECT_ORIGINS,
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'frame-src': ["'none'"],
    'manifest-src': ["'self'"],
    'media-src': ["'none'"],
    'worker-src': ["'none'"],
    'child-src': ["'none'"],
    'upgrade-insecure-requests': [],
    'block-all-mixed-content': [],
    'report-uri': [CSP_REPORT_URI],
    'report-to': ['csp-endpoint'],
  };

  return Object.entries(directives)
    .map(([directive, values]) =>
      values.length > 0 ? `${directive} ${values.join(' ')}` : directive
    )
    .join('; ');
}

/**
 * Middleware to attach nonce and set CSP header on every response
 */
function cspMiddleware(req, res, next) {
  const nonce = generateNonce();

  // Attach nonce to res.locals so it's accessible in route handlers
  res.locals.nonce = nonce;

  // Set Report-To header for modern CSP reporting
  res.setHeader(
    'Report-To',
    JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: `https://${req.hostname}${CSP_REPORT_URI}` }],
      include_subdomains: true,
    })
  );

  // Set the Content-Security-Policy header
  res.setHeader('Content-Security-Policy', buildCSPHeader(nonce));

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Disable legacy XSS auditor (CSP handles it)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  next();
}

/**
 * Generate the secure HTML page with nonce-protected inline scripts
 * @param {string} nonce - The per-request nonce
 * @returns {string} HTML content
 */
function generateHTML(nonce) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Secure CSP Page</title>

  <!-- Inline styles require the nonce because 'unsafe-inline' is disallowed -->
  <style nonce="${nonce}">
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e0e0e0;
    }

    .container {
      max-width: 700px;
      width: 90%;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 2.5rem;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #10b981;
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.75rem;
      line-height: 1.2;
    }

    .subtitle {
      color: #9ca3af;
      margin-bottom: 2rem;
      line-height: 1.6;
    }

    .csp-info {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }

    .csp-info h3 {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      margin-bottom: 0.75rem;
    }

    .nonce-display {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.8rem;
      color: #a78bfa;
      word-break: break-all;
      padding: 0.5rem;
      background: rgba(167, 139, 250