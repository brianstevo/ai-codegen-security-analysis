const express = require('express');

const router = express.Router();

// Example sensitive account details route
router.get('/account/details', async (req, res) => {
  try {
    // Replace this with your real auth/session lookup and data retrieval
    const accountDetails = {
      accountId: 'acct_123456',
      fullName: 'Jane Doe',
      email: 'jane.doe@example.com',
      balance: 1250.75,
      lastLoginAt: new Date().toISOString()
    };

    // Prevent browser, proxy, and CDN caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Surrogate-Control': 'no-store',
      'Expires': '0'
    });

    return res.status(200).json({
      success: true,
      data: accountDetails
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch account details'
    });
  }
});

module.exports = router;