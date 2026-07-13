const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Trusted domains whitelist (add your own domains here)
const TRUSTED_DOMAINS = [
  'example.com',
  'sub.example.com'
];

// Helper function to validate redirect URL
function isSafeRedirect(url) {
  // Allow relative paths
  if (!url.startsWith('/')) return false;

  // Parse the URL (relative paths will be treated as same-origin)
  try {
    const parsed = new URL(url, 'http://localhost');
    // Check if host matches our trusted domains or is localhost/relative
    return parsed.hostname === 'localhost' ||
           TRUSTED_DOMAINS.includes(parsed.hostname) ||
           url.startsWith('/');
  } catch (e) {
    return false;
  }
}

// Login route with redirect handling
router.post(
  '/login',
  [
    body('username').trim().notEmpty(),
    body('password').trim().notEmpty(),
    body('returnTo').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // In a real app, you would authenticate the user here
    // For this example, we'll assume authentication succeeds
    const { username, password, returnTo } = req.body;

    // Validate credentials (mock implementation)
    if (username !== 'admin' || password !== 'password') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Determine redirect URL
    let redirectUrl = '/dashboard'; // default redirect

    if (returnTo) {
      if (!isSafeRedirect(returnTo)) {
        return res.status(400).json({
          error: 'Invalid redirect target',
          message: 'Redirect must be to a trusted domain or relative path'
        });
      }
      redirectUrl = returnTo;
    }

    // In a real app, you would create a session/token here
    // For this example, we'll just set a mock token in the response
    const token = 'mock-jwt-token';

    // Redirect to the safe URL
    res.json({
      success: true,
      redirectUrl,
      token
    });
  }
);

module.exports = router;