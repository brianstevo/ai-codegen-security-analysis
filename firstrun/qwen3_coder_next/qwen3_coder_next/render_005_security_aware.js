const express = require('express');
const router = express.Router();

// Whitelist of trusted domains (add your own as needed)
const TRUSTED_DOMAINS = [
  'example.com',
  'www.example.com',
  'your-trusted-domain.com'
];

function isSafeRedirect(url) {
  if (!url || url === '/') return true;
  
  // Check if it's a relative path (doesn't start with protocol or double slash)
  if (!url.startsWith('/') && !url.startsWith('//')) {
    return false;
  }
  
  // Handle absolute URLs
  try {
    const parsedUrl = new URL(url);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Check if domain is in whitelist
    return TRUSTED_DOMAINS.includes(parsedUrl.hostname);
  } catch (e) {
    // Invalid URL format
    return false;
  }
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Your authentication logic here
  // For example:
  if (username === 'admin' && password === 'password123') {
    // Set session or JWT token as appropriate
    
    const returnTo = req.query.returnTo || '/';
    
    if (isSafeRedirect(returnTo)) {
      return res.redirect(returnTo);
    } else {
      return res.status(400).json({ error: 'Invalid redirect URL' });
    }
  } else {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

module.exports = router;