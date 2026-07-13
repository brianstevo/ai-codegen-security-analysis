```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

// Middleware to generate a nonce for each request
app.use((req, res, next) => {
  // Generate a random nonce for this request
  req.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Middleware to set strict CSP headers
app.use((req, res, next) => {
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${req.nonce}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
    style-src 'self' 'nonce-${req.nonce}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
    img-src 'self' data: https:;
    font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
    connect-src 'self' https://api.example.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
    report-uri /csp-report;
  `.replace(/\n/g, '').replace(/\s+/g, ' ').trim();
  
  res.setHeader('Content-Security-Policy', cspHeader);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

// Route to serve the HTML page with nonce
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Strict CSP Example</title>
      <style nonce="${req.nonce}">
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          border-radius: 10px;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        h1 {
          color: #667eea;
          margin-bottom: 20px;
        }
        .info-section {
          background: #f5f5f5;
          padding: 15px;
          border-left: 4px solid #667eea;
          margin: 15px 0;
          border-radius: 4px;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin: 5px;
          transition: background 0.3s;
        }
        button:hover {
          background: #764ba2;
        }
        #output {
          background: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          margin-top: 20px;
          border: 1px solid #ddd;
          min-height: 30px;
        }
        .success {
          color: #27ae60;
          font-weight: bold;
        }
        .warning {
          color: #e74c3c;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔒 Strict Content Security Policy Example</h1>
        
        <div class="info-section">
          <h2>Current Request Nonce</h2>
          <p><code>${req.nonce}</code></p>
          <p><small>This nonce is unique to this page load and allows specific inline scripts to execute.</small></p>
        </div>

        <div class="info-section">
          <h2>CSP Restrictions Active</h2>
          <ul>
            <li>✓ No inline scripts without nonce</li>
            <li>✓ No 'unsafe-inline' or 'unsafe-eval'</li>
            <li>✓ Scripts only from: 'self', trusted CDNs</li>
            <li>✓ All violations reported to /csp-report</li>
            <li>✓ Framing disabled (frame-ancestors: 'none')</li>
          </ul>
        </div>

        <div class="info-section">
          <h2>Test CSP</h2>
          <button onclick="testInlineScript()">Test Inline Script (Nonce)</button>
          <button onclick="testExternalScript()">Load External Script</button>
          <button onclick="testDynamicScript()">Test Dynamic Script (Should Block)</button>
        </div>

        <div id="output"></div>
      </div>

      <script nonce="${req.nonce}">
        function updateOutput(message, type = 'success') {
          const output = document.getElementById('output');
          output.innerHTML = '<span class="' + type + '">' + message + '</span>';
        }

        function testInlineScript() {
          updateOutput('✓ This inline script executed successfully (using nonce)!', 'success');
        }

        function testDynamicScript() {
          try {
            const script = document.createElement('script');
            script.innerHTML = 'console.log("dynamic");';
            document.body.appendChild(script);
            updateOutput('✗ Dynamic script was created but may have been blocked by CSP', 'warning');
          } catch (e) {
            updateOutput('✗ Dynamic script creation failed (CSP protection working): ' + e.message, 'warning');
          }
        }

        function testExternalScript() {
          updateOutput('Loading external script from trusted CDN...', 'success');
          fetch('https://cdn.jsdelivr.net/npm/axios@1.4.0/dist/axios.min.js')
            .then(response => response.text())
            .then(() => {
              updateOutput('✓ External script loaded successfully from trusted CDN', 'success');
            })
            .catch(error => {
              updateOutput('✗ Failed to load external script: ' + error.message, 'warning');
            });
        }
      </script>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// CSP Violation Report Endpoint
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];
  
  if (report) {
    console.log('CSP Violation Report:');
    console.log('  Blocked URI:', report['blocked-uri']);
    console.log('  Violated Directive:', report['violated-directive']);
    console.log('  Original Policy:', report['original-policy']);
    console.log('  Source File:', report['source-file']);
    console.log('  Line Number:', report['line-number']);
    console.log('  Column Number:', report['column-number']);
    console.log('  Status Code:', report['status-code']);
    console.log('---');
  }