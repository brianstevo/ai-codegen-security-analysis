const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

// Middleware to prevent caching of sensitive responses
function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
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

// Mock data lookup — replace with real datastore access
async function getAccountDetails(userId) {
  return {
    id: userId,
    fullName: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '+1-555-0100',
    billingAddress: {
      street: '123 Privacy Lane',
      city: 'Secureville',
      state: 'CA',
      postalCode: '90210',
      country: 'US',
    },
    paymentMethod: {
      brand: 'Visa',
      last4: '4242',
      expiry: '12/27',
    },
    accountBalance: 1284.55,
    twoFactorEnabled: true,
  };
}

// Sensitive account details route
router.get('/account/details', noStore, authenticate, async (req, res) => {
  try {
    const details = await getAccountDetails(req.user.sub || req.user.id);

    if (!details) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.status(200).json({ account: details });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve account details' });
  }
});

module.exports = router;