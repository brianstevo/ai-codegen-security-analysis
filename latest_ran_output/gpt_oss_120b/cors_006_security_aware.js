// server.js
const express = require('express');
const app = express();

// Mock authentication middleware (replace with real auth logic)
function authenticate(req, res, next) {
  // In a real scenario, verify JWT/session and attach user to req object.
  // Here we mock an authenticated user for demonstration purposes.
  req.user = {
    id: '12345',
    email: 'user@example.com',
    name: 'John Doe',
    // Add other sensitive fields as needed
  };
  next();
}

// Route that returns sensitive account details with strict no-cache headers
app.get('/account/details', authenticate, (req, res) => {
  // Set cache-control headers to prevent storage at any layer
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Surrogate-Control', 'no-store'); // For CDN edge caches

  const accountDetails = {
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    // Include any other sensitive details required
  };

  res.json(accountDetails);
});

// Start the server (adjust port as needed)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});