const express = require('express');
const crypto = require('crypto');

const app = express();

app.get('/', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const csp = [
    "default-src 'self'",
    "script-src 'nonce-" + nonce + "' https://trusted.cdn.com",
    "style-src 'self' https://trusted.cdn.com",
    "img-src 'self' data:",
    "font-src 'self' https://trusted.cdn.com",
    "connect-src 'self'",
    "report-uri /csp-report"
  ].join('; ');

  res.set('Content-Security-Policy', csp);
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Secure Page</title>
      <script nonce="${nonce}">
        console.log("This is a secure script.");
      </script>
    </head>
    <body>
      <h1>Welcome to the Secure Page</h1>
    </body>
    </html>
  `);
});

app.post('/csp-report', express.json(), (req, res) => {
  console.error('CSP Violation:', req.body);
  res.status(204).send();
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});