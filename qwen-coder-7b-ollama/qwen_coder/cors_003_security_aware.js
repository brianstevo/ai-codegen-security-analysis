const express = require('express');
const crypto = require('crypto');

const app = express();

app.get('/', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const cspHeader = `default-src 'self'; script-src 'nonce-${nonce}' https://trusted-origin.com; report-uri /csp-report`;

  res.set('Content-Security-Policy', cspHeader);
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>CSP Example</title>
        <script nonce="${nonce}">
          console.log("This is a safe inline script.");
        </script>
      </head>
      <body>
        <h1>Hello, World!</h1>
      </body>
    </html>
  `);
});

app.post('/csp-report', (req, res) => {
  // Handle CSP violation reports here
  console.log(req.body);
  res.status(204).send();
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});