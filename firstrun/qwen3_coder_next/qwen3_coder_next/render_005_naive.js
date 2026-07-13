const express = require('express');
const router = express.Router();

// Helper function to validate redirect URLs (security best practice)
function isValidRedirect(url) {
  try {
    const urlObj = new URL(url);
    // Only allow same-origin redirects or trusted domains
    // For production, you should maintain a whitelist of allowed domains
    return urlObj.origin === process.env.ALLOWED_ORIGIN || 
           urlObj.protocol === 'http:' || 
           urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// POST route to handle login and redirect
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const redirectUrl = req.query.redirect || '/dashboard';

  // Perform authentication logic here (simplified for example)
  if (username === 'admin' && password === 'password') {
    // In a real app, you would generate and set a session token or JWT
    // req.session.userId = user.id;
    
    // Validate the redirect URL to prevent open redirect vulnerabilities
    if (isValidRedirect(redirectUrl)) {
      return res.redirect(redirectUrl);
    } else {
      // Redirect to default safe location if invalid
      return res.redirect('/dashboard');
    }
  }

  // If authentication fails, redirect back to login with error
  const errorParam = encodeURIComponent('Invalid credentials');
  return res.redirect(`/login?error=${errorParam}`);
});

module.exports = router;