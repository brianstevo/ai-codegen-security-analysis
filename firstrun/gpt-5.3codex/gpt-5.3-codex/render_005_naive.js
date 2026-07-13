const express = require('express');
const router = express.Router();

/**
 * Example login route:
 * Expects: { email, password } in req.body
 * Redirect target can be provided as ?redirect=/dashboard
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { redirect } = req.query;

    // TODO: Replace with real authentication logic
    const isAuthenticated = Boolean(email && password);

    if (!isAuthenticated) {
      return res.status(401).send('Invalid credentials');
    }

    // Prevent open redirects by allowing only relative paths
    const safeRedirect =
      typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/';

    return res.redirect(safeRedirect);
  } catch (err) {
    return res.status(500).send('Login failed');
  }
});

module.exports = router;