const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Middleware to verify JWT and attach user to request
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to apply no-cache headers for sensitive responses
function noStoreCacheHeaders(req, res, next) {
  // Prevent storage in browser and proxy caches
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  // Legacy HTTP/1.0 proxy support
  res.set('Pragma', 'no-cache');
  // Force revalidation / disable caching at intermediaries
  res.set('Expires', '0');
  // Prevent CDN / surrogate caches (e.g., Fastly, Varnish) from storing
  res.set('Surrogate-Control', 'no-store');
  next();
}

// Mock data lookup — replace with real datastore access
async function getAccountDetails(userId) {
  return {
    id: userId,
    fullName: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '+1-555-0100',
    billingAddress: {
      line1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US'
    },
    paymentMethods: [
      { type: 'card', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2027 }
    ],
    accountBalance: 1542.75,
    currency: 'USD',
    twoFactorEnabled: true,
    lastLoginAt: new Date().toISOString()
  };
}

router.get('/account/details', authenticate, noStoreCacheHeaders, async (req, res) => {
  try {
    const details = await getAccountDetails(req.user.sub || req.user.id);

    if (!details) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Explicitly disable conditional caching for this response
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');

    return res.status(200).json(details);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve account details' });
  }
});

module.exports = router;