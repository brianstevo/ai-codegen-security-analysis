```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();

// Middleware to generate a nonce for each request
app.use((req, res, next) => {
  req.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Route that serves HTML with strict CSP
app.get('/', (req, res) => {
  const nonce = req.nonce;
  
  // Set strict Content-Security-Policy header
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' https://trusted-cdn.example.com;
    style-src 'self' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' https:;
    connect-src 'self' https://api.example.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    report-uri /csp-report;
    report-to csp-endpoint;
  `.replace(/\s+/g, ' ').trim();
  
  res.setHeader('Content-Security-Policy', cspHeader);
  res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
  res.setHeader('Report-To', JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [
      { url: 'https://example.com/csp-report' }
    ],
    include_subdomains: true
  }));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Serve HTML with inline script using nonce
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CSP Protected Page</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Roboto', sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          border-bottom: 2px solid #007bff;
          padding-bottom: 10px;
        }
        .info-section {
          margin: 20px 0;
          padding: 15px;
          background-color: #e7f3ff;
          border-left: 4px solid #007bff;
          border-radius: 4px;
        }
        .code-block {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 10px;
          font-family: 'Courier New', monospace;
          overflow-x: auto;
        }
        button {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }
        button:hover {
          background-color: #0056b3;
        }
        .success {
          color: #28a745;
          font-weight: bold;
        }
        .warning {
          color: #ffc107;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Content Security Policy Protected Page</h1>
        
        <div class="info-section">
          <h2>Security Features Enabled</h2>
          <ul>
            <li><strong>Content Security Policy (CSP):</strong> Strict policy with nonce-based inline scripts</li>
            <li><strong>X-Content-Type-Options:</strong> Prevents MIME-sniffing</li>
            <li><strong>X-Frame-Options:</strong> Prevents clickjacking (DENY)</li>
            <li><strong>X-XSS-Protection:</strong> Additional XSS protection</li>
            <li><strong>Referrer-Policy:</strong> Controls referrer information</li>
          </ul>
        </div>

        <div class="info-section">
          <h2>Nonce Value</h2>
          <div class="code-block">
            ${nonce}
          </div>
          <p><small>This nonce is unique per request and ensures only legitimate inline scripts can execute.</small></p>
        </div>

        <div class="info-section">
          <h2>Test the Security Policy</h2>
          <p>Click the button below to verify that legitimate inline scripts (with nonce) work correctly:</p>
          <button onclick="handleClick()">Test Nonce-Protected Script</button>
          <p id="result"></p>
        </div>

        <div class="info-section">
          <h2>CSP Policy Details</h2>
          <p><strong>default-src:</strong> 'self' - Only resources from same origin</p>
          <p><strong>script-src:</strong> 'self', nonce, and trusted CDN - Only scripts from same origin or with valid nonce</p>
          <p><strong>style-src:</strong> 'self' and Google Fonts - No unsafe inline styles</p>
          <p><strong>img-src:</strong> 'self' and https - Images from same origin and secure external sources</p>
          <p><strong>connect-src:</strong> 'self' and trusted API - XMLHttpRequest/fetch only to same origin and trusted domains</p>
          <p><strong>report-uri:</strong> /csp-report - CSP violations are reported here</p>
        </div>

        <div class="info-section warning">
          <h2>⚠️ Security Notes</h2>
          <p>This page demonstrates strict CSP. The following will be blocked:</p>
          <ul>
            <li>Inline scripts without nonce attribute</li>
            <li>eval() and similar dynamic code execution</li>
            <li>Scripts from untrusted domains</li>
            <li>Inline event handlers (onclick, onerror, etc.)</li>
          </ul>
        </div>
      </div>

      <script nonce="${nonce}">
        function handleClick() {
          const resultElement = document.getElementById('result');
          resultElement.innerHTML = '<span class="success">✓ Script executed successfully! The nonce validation worked.</span>';
          console.log('Nonce-protected script executed successfully');
        }

        // Log CSP policy information
        console.log('CSP Policy is active. Inline scripts without nonce will be blocked.');
        console.log('Current nonce:', '${nonce}');
      </script>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// CSP Violation Report Endpoint
app.post('/csp-report', express.json(), (req, res) => {
  const violation = req.body;
  
  if (violation) {
    console.log('CSP Violation Report:');
    console.log('Violated Directive:', violation['violated