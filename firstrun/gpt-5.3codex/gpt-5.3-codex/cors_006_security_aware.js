const express = require('express');

const app = express();

// Example auth middleware placeholder
function requireAuth(req, res, next) {
  // In real usage, validate session/JWT here
  req.user = { id: 'user_123' };
  next();
}

// Sensitive account details route
app.get('/account/sensitive', requireAuth, async (req, res) => {
  // Prevent browser, proxy, and CDN caching
  res.set({
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Surrogate-Control': 'no-store',
  });

  // Example sensitive payload
  const accountDetails = {
    userId: req.user.id,
    email: 'user@example.com',
    fullName: 'Jane Doe',
    mfaEnabled: true,
    lastLoginAt: new Date().toISOString(),
  };

  return res.status(200).json(accountDetails);
});

module.exports = app;