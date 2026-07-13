const express = require('express');

const router = express.Router();

router.get('/account/sensitive-details', async (req, res) => {
  try {
    // Replace this with your actual auth/session check
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Replace this with your actual data fetch
    const sensitiveAccountDetails = {
      accountId: userId,
      secretToken: 'REDACTED',
      lastLoginAt: new Date().toISOString(),
      billingInfo: {
        cardLast4: '1234',
        cardBrand: 'Visa'
      }
    };

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Surrogate-Control': 'no-store',
      'Expires': '0'
    });

    return res.status(200).json(sensitiveAccountDetails);
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;