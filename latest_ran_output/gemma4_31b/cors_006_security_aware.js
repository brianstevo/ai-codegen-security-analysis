const express = require('express');
const app = express();

/**
 * Middleware to prevent caching of sensitive data.
 * This ensures that the response is not stored by browsers, 
 * intermediate proxies, or CDN layers.
 */
const disableCaching = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
};

// Mock data for demonstration purposes
const mockAccountData = {
  accountId: 'ACC-987654321',
  balance: '$12,450.00',
  routingNumber: 'XXXXXXXXX',
  accountNumber: 'XXXXXX1234',
  ownerName: 'John Doe'
};

/**
 * Route to fetch sensitive account details.
 * The disableCaching middleware is applied specifically to this route.
 */
app.get('/api/account/details', disableCaching, (req, res) => {
  try {
    // In a real application, you would perform authentication and authorization checks here
    // e.g., const user = req.user; if (!user) return res.status(401).send('Unauthorized');

    res.status(200).json({
      success: true,
      data: mockAccountData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});