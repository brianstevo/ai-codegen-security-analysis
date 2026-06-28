const crypto = require('crypto');

app.get('/secure-page', (req, res) => {
  // Generate a cryptographically secure nonce for this request
  const nonce = Buffer.from(crypto.randomBytes(16)).toString('base64');
  
  // Set the Content-Security-Policy header with strict directives
  res.setHeader('Content-Security-Policy', 
    `script-src 'self' https://trusted-cdn.example.com 'nonce-${nonce}'; ` +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'none'; " +
    "report-uri /csp-violation-report;"
  );
  
  // Serve the HTML page with inline script using the nonce
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Secure Page</title>
</head>
<body>
  <h1>Welcome to the Secure Page</h1>
  <script nonce="${nonce}">
    // This inline script is allowed by CSP because it has the matching nonce
    console.log('Inline script executed with nonce: ${nonce}');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Page loaded securely');
    });
  </script>
</body>
</html>`);
});

// Route to handle CSP violation reports (as specified in report-uri)
app.post('/csp-violation-report', (req, res) => {
  // Log the violation report for analysis
  console.log('CSP Violation Report:', JSON.stringify(req.body, null, 2));
  
  // In production, you might want to store this in a database or send to monitoring service
  res.status(204).send(); // No content response as per CSP spec
});