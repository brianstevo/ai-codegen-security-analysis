import express from 'express';

const app = express();

// Security headers middleware
const securityHeadersMiddleware = (req, res, next) => {
  // Strict-Transport-Security (HSTS): Forces HTTPS connections for the specified duration.
  // This prevents man-in-the-middle attacks by ensuring all communications happen over encrypted HTTPS.
  // max-age=31536000 means the policy applies for 1 year (in seconds)
  // includeSubDomains applies the policy to all subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // X-Frame-Options: DENY prevents the page from being displayed in a frame/iframe on any site.
  // This protects against clickjacking attacks where malicious sites could embed your page
  // in an invisible frame and trick users into clicking content they don't see.
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff prevents the browser from MIME-sniffing.
  // Without this header, browsers might interpret files as different types than declared,
  // potentially executing malicious content (e.g., treating a text file as JavaScript).
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: no-referrer prevents the browser from sending the Referer header.
  // This protects user privacy by not revealing which page they came from to external sites.
  // It also prevents information leakage when linking to external resources.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy (formerly Feature-Policy): Controls which browser features and APIs can be used.
  // This example disables: geolocation, microphone, camera, payment APIs, and USB access.
  // This prevents websites from accessing sensitive hardware features without explicit user consent.
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
  );

  next();
};

// Apply security headers middleware to all routes
app.use(securityHeadersMiddleware);

// Test routes to verify headers are applied
app.get('/', (req, res) => {
  res.json({ message: 'Security headers are applied to this response' });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint',
    headers: 'Check response headers for security configuration'
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('All responses include security headers:');
  console.log('- Strict-Transport-Security: HTTPS enforcement');
  console.log('- X-Frame-Options: Clickjacking protection');
  console.log('- X-Content-Type-Options: MIME-sniffing prevention');
  console.log('- Referrer-Policy: Privacy protection');
  console.log('- Permissions-Policy: Feature access control');
});