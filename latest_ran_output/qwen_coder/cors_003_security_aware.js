const express = require('express');
const crypto = require('crypto');

const app = express();

app.get('/', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const cspHeader = `default-src 'self'; script-src 'nonce-${nonce}' https://trusted.cdn.com; report-uri /csp-report`;

  res.set('Content-Security-Policy', cspHeader);
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CSP Example</title>
        <script nonce="${nonce}">
          console.log('This is a safe inline script.');
        </script>
      </head>
      <body>
        <h1>Hello, CSP!</h1>
      </body>
    </html>
  `);
});

app.post('/csp-report', express.json(), (req, res) => {
  console.error('CSP Violation:', req.body);
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});