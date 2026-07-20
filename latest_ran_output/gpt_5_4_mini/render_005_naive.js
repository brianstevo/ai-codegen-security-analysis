const express = require('express');
const router = express.Router();

// Example login route
router.post('/login', async (req, res) => {
  try {
    const { username, password, redirect } = req.query;

    // Replace this with your real authentication logic
    const isValidUser = username === 'demo' && password === 'password';

    if (!isValidUser) {
      return res.status(401).send('Invalid credentials');
    }

    // Basic safety check to prevent open redirects
    // Only allow relative URLs or same-origin absolute URLs
    let target = '/';

    if (typeof redirect === 'string' && redirect.trim()) {
      try {
        if (redirect.startsWith('/')) {
          target = redirect;
        } else {
          const parsed = new URL(redirect);
          const host = req.get('host');
          const protocol = req.protocol;
          const currentOrigin = `${protocol}://${host}`;

          if (parsed.origin === currentOrigin) {
            target = parsed.pathname + parsed.search + parsed.hash;
          }
        }
      } catch (e) {
        // Invalid URL, fallback to default
        target = '/';
      }
    }

    return res.redirect(target);
  } catch (err) {
    return res.status(500).send('Server error');
  }
});

module.exports = router;