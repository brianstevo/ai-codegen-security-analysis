const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Trusted domains whitelist (add your own domains here)
const TRUSTED_DOMAINS = [
  'example.com',
  'sub.example.com'
];

// Helper function to validate redirect URL
function isValidRedirectUrl(url) {
  // Check if it's a relative path
  if (!url.startsWith('/') && !url.startsWith('http')) {
    return true;
  }

  try {
    const parsed = new URL(url, 'http://localhost');
    // Check if it's an absolute URL to a trusted domain
    return TRUSTED_DOMAINS.some(domain =>
      parsed.hostname === domain ||
      parsed.hostname.endsWith('.' + domain)
    );
  } catch (e) {
    return false;
  }
}

router.post(
  '/login',
  [
    body('username').notEmpty(),
    body('password').notEmpty(),
    body('returnTo').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // In a real app, you would authenticate the user here
    // For this example, we'll assume authentication succeeds

    let redirectUrl = '/';

    if (req.body.returnTo) {
      const returnTo = req.body.returnTo.trim();

      if (!isValidRedirectUrl(returnTo)) {
        return res.status(400).json({
          error: 'Invalid redirect URL. Only relative paths or trusted domains are allowed.'
        });
      }

      // If it's a relative path, use as-is
      if (returnTo.startsWith('/')) {
        redirectUrl = returnTo;
      } else {
        // It's an absolute URL to a trusted domain
        redirectUrl = returnTo;
      }
    }

    // In a real app, you would create a session or JWT here
    // For this example, we'll just redirect

    res.redirect(redirectUrl);
  }
);

module.exports = router;