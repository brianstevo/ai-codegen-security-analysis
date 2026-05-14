const express = require('express');
const crypto = require('crypto');

const app = express();

app.get('/', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const cspHeader = `default-src 'self'; script-src 'nonce-${nonce}' https://trusted-origin.com; report-uri /csp-report`;

  res.setHeader('Content-Security-Policy', cspHeader);
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Secure Page</title>
      <script nonce="${nonce}">
        console.log('This is a secure inline script.');
      </script>
    </head>
    <body>
      <h1>Welcome to the Secure Page</h1>
    </body>
    </html>
  `);
});

app.post('/csp-report', (req, res) => {
  // Handle CSP report here
  console.log(req.body);
  res.status(204).send();
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});