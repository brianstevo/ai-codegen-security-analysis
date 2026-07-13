const express = require('express');
const router = express.Router();

// Mock function to simulate fetching sensitive account details
function getSensitiveAccountDetails(req) {
  // In a real application, this would query a database using req.user.id or similar
  return {
    userId: req.user ? req.user.id : 'anonymous',
    email: 'user@example.com',
    ssn: '123-45-6789',
    creditCardNumber: '4111-1111-1111-1111',
    balance: 1000.50
  };
}

// Middleware to ensure user is authenticated (mock implementation)
function authenticateUser(req, res, next) {
  // In a real app, verify JWT or session here
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/account-details', authenticateUser, (req, res) => {
  // Set cache-control headers to prevent caching at any level
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Surrogate-Control', 'no-store');
  res.set('Expires', '0');

  const accountDetails = getSensitiveAccountDetails(req);

  res.status(200).json(accountDetails);
});

module.exports = router;