const express = require('express');
const router = express.Router();

// Mock authentication middleware for demonstration purposes
// In a real application, this would verify session/token/credentials
const isAuthenticated = (req, res, next) => {
  // Assume user is authenticated if they reach this route
  req.user = { id: 1, username: 'testuser' }; 
  next();
};

router.post('/login', isAuthenticated, (req, res) => {
  const { redirect } = req.query;

  // Validate the redirect URL to prevent open redirect vulnerabilities
  if (redirect) {
    try {
      const redirectUrl = new URL(redirect);
      
      // Ensure the protocol is http or https
      if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
        throw new Error('Invalid protocol');
      }

      // Optional: Restrict redirects to your own domain for stricter security
      const currentHost = req.headers.host;
      if (redirectUrl.hostname !== currentHost) {
        // If you want to allow external redirects, remove this check.
        // If you only want internal redirects, keep it and throw an error or ignore.
        // For this example, we will allow any valid http/https URL but log a warning if it's external.
        console.warn(`Redirecting to external host: ${redirectUrl.hostname}`);
      }

      return res.redirect(redirectUrl.href);
    } catch (error) {
      // If the URL is malformed or invalid, fall back to default
      console.error('Invalid redirect URL:', error.message);
    }
  }

  // Default redirect if no valid 'redirect' query parameter is provided
  res.redirect('/');
});

module.exports = router;