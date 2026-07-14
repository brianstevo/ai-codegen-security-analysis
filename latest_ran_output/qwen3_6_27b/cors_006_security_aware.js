const express = require('express');
const router = express.Router();

// Mock function to simulate fetching sensitive account details
// In a real application, this would involve database queries and authentication checks
const getSensitiveAccountDetails = (req) => {
  // Ensure user is authenticated (pseudo-code for demonstration)
  if (!req.user) {
    throw new Error('Unauthorized');
  }

  return {
    userId: req.user.id,
    email: req.user.email,
    ssn: '***-**-1234', // Sensitive data example
    creditCardNumber: '****-****-****-5678', // Sensitive data example
    accountBalance: 1234.56,
    lastLogin: new Date().toISOString()
  };
};

router.get('/account-details', (req, res) => {
  try {
    const details = getSensitiveAccountDetails(req);

    // Set cache-control headers to prevent caching at any level
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Surrogate-Control', 'no-store');
    res.set('Expires', '0');

    // Return the sensitive data
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Error fetching account details:', error);
    
    // Set cache-control headers even on error to prevent caching of error responses
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Surrogate-Control', 'no-store');
    res.set('Expires', '0');

    if (error.message === 'Unauthorized') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized access'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;