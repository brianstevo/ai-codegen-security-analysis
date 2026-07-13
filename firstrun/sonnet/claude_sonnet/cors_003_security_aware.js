```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Trusted origins configuration
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

const CSP_REPORT_URI = process.env.CSP_REPORT_URI || '/csp-violation-report';

/**
 * Generates a cryptographically secure random nonce
 * @returns {string} Base64-encoded nonce
 */
function generateNonce() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Builds the Content-Security-Policy header value
 * @param {string} nonce - The per-request nonce
 * @returns {string} The complete CSP header value
 */
function buildCSPHeader(nonce) {
  const nonceDirective = `'nonce-${nonce}'`;

  const directives = {
    'default-src': ["'none'"],
    'script-src': [
      ...TRUSTED_SCRIPT_ORIGINS,
      nonceDirective,
      // Explicitly NO 'unsafe-inline' or 'unsafe-eval'
    ],
    'style-src': [
      ...TRUSTED_STYLE_ORIGINS,
      nonceDirective,
    ],
    'font-src': TRUSTED_FONT_ORIGINS,
    'img-src': TRUSTED_IMG_ORIGINS,
    'connect-src': ["'self'"],
    'media-src': ["'none'"],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'none'"],
    'report-uri': [CSP_REPORT_URI],
    'upgrade-insecure-requests': [],
  };

  return Object.entries(directives)
    .map(([directive, values]) =>
      values.length > 0
        ? `${directive} ${values.join(' ')}`
        : directive
    )
    .join('; ');
}

/**
 * Middleware to generate nonce and set CSP header on every request
 */
function cspMiddleware(req, res, next) {
  const nonce = generateNonce();

  // Attach nonce to res.locals so it's available in route handlers
  res.locals.nonce = nonce;

  // Set the strict CSP header
  res.setHeader('Content-Security-Policy', buildCSPHeader(nonce));

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Disabled in favor of CSP
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  next();
}

/**
 * Generates the HTML page with nonce-protected inline scripts
 * @param {string} nonce - The per-request nonce
 * @returns {string} Complete HTML string
 */
function generateHTMLPage(nonce) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="">
  <title>Secure Page with CSP</title>

  <!-- Inline styles require nonce too -->
  <style nonce="${nonce}">
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .container {
      max-width: 800px;
      width: 100%;
      background-color: #1e293b;
      border-radius: 12px;
      padding: 2.5rem;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      border: 1px solid #334155;
    }

    h1 {
      font-size: 2rem;
      color: #38bdf8;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: #94a3b8;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }

    .csp-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background-color: #064e3b;
      color: #6ee7b7;
      padding: 0.4rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 2rem;
      border: 1px solid #065f46;
    }

    .csp-badge::before {
      content: '🔒';
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .info-card {
      background-color: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1.25rem;
    }

    .info-card h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      margin-bottom: 0.5rem;
    }

    .info-card p {
      color: #e2e8f0;
      font-size: 0.95rem;
      word-break: break-all;
    }

    .nonce-display {
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      color: #a78bfa;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 2rem;
    }

    button {
      padding: 0.625rem 1.25rem;
      border-radius: 6px;
      border: none;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    button:hover {
      opacity: 0.85;
    }

    .btn-primary {
      background-color: #3b82f6;
      color: #ffffff;
    }

    .btn-secondary {
      background-color: #334155;
      color: #e2e8f0;
    }

    .btn-