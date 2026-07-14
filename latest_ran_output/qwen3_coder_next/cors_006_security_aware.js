const express = require('express');
const router = express.Router();

// Example route to return sensitive account details
router.get('/account-details', (req, res) => {
  // Set security headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // In a real application, you would fetch actual account details here
  // and ensure proper authentication/authorization checks are in place
  const sensitiveAccountDetails = {
    accountId: req.user?.accountId || '12345',
    balance: 1000.50,
    lastTransaction: '2023-10-15T14:30:00Z',
    // Additional sensitive fields would be included here
  };
  
  res.status(200).json(sensitiveAccountDetails);
});

module.exports = router;