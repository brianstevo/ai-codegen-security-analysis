const express = require('express');
const router = express.Router();

// Mock authentication middleware for demonstration purposes
const isAuthenticated = (req, res, next) => {
  // In a real application, this would verify session or token
  req.user = { id: 1, username: 'testuser' };
  next();
};

router.post('/login', isAuthenticated, (req, res) => {
  const { redirect } = req.query;

  // Validate the redirect URL to prevent open redirect vulnerabilities
  // Ensure it is a relative path or matches your domain
  if (redirect && typeof redirect === 'string') {
    try {
      const parsedUrl = new URL(redirect, req.protocol + '://' + req.get('host'));
      
      // Only allow redirects to the same origin
      if (parsedUrl.origin === `${req.protocol}://${req.get('host')}`) {
        return res.redirect(parsedUrl.pathname + parsedUrl.search);
      }
    } catch (error) {
      // If URL parsing fails, fall back to default redirect
    }
  }

  // Default redirect if no valid redirect URL is provided
  res.redirect('/dashboard');
});

module.exports = router;