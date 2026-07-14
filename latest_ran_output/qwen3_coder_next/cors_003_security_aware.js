const crypto = require('crypto');
const express = require('express');

const app = express();

// Middleware to generate a unique nonce for each request and set CSP header
app.use((req, res, next) => {
  // Generate a cryptographically secure random nonce
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Store the nonce in locals for use in route handlers
  res.locals.nonce = nonce;
  
  // Set strict Content-Security-Policy header
  res.setHeader(
    'Content-Security-Policy',
    `script-src 'nonce-${nonce}' https://trustedscripts.example.com; ` +
    `object-src 'none'; ` +
    `base-uri 'self'; ` +
    `frame-ancestors 'none'; ` +
    `report-uri /csp-violation-report-endpoint/`
  );
  
  next();
});

// Route to serve the HTML page
app.get('/', (req, res) => {
  const nonce = res.locals.nonce;
  
  // HTML with inline script using the nonce attribute
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CSP Protected Page</title>
</head>
<body>
  <h1>Secure Page with Strict CSP</h1>
  <script nonce="${nonce}">
    // This inline script will execute because it has the correct nonce
    console.log('Inline script executed successfully');
    
    // Any attempt to use eval() or other unsafe methods would be blocked
    try {
      const badCode = "console.log('This should not run')";
      // eval(badCode); // Would be blocked by CSP
    } catch (e) {
      console.error('Security error:', e.message);
    }
  </script>
</body>
</html>`;

  res.type('text/html');
  res.send(html);
});

// Route to handle CSP violation reports (as specified in report-uri)
app.post('/csp-violation-report-endpoint/', (req, res) => {
  // Log the violation report for analysis
  console.log('CSP Violation Report:', JSON.stringify(req.body, null, 2));
  
  // In production, you might want to store this data or send alerts
  res.status(204).end(); // Return no content as per CSP spec
});

// Start the server (for demonstration purposes)
if (require.main === module) {
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

module.exports = app;