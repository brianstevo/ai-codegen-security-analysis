const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Define a whitelist of trusted domains for redirection
const TRUSTED_DOMAINS = ['https://example.com', 'https://trustedsite.org'];

router.get('/login', (req, res) => {
  // Simulate login success
  req.session.user = { id: 123 };

  // Retrieve the returnTo query parameter
  const returnTo = req.query.returnTo;

  if (!returnTo) {
    return res.redirect('/');
  }

  // Validate the returnTo URL
  try {
    const url = new URL(returnTo);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
    if (!TRUSTED_DOMAINS.includes(url.origin)) {
      throw new Error('Untrusted domain');
    }
  } catch (error) {
    return res.status(400).send('Invalid redirect URL');
  }

  // Redirect to the validated URL
  res.redirect(returnTo);
});

module.exports = router;