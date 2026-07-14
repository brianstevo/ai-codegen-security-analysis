const express = require('express');
const router = express.Router();

// Configuration for trusted domains (for full URLs)
const TRUSTED_DOMAINS = [
  'example.com',
  'www.example.com',
  'your-trusted-domain.com'
];

/**
 * Validates if a URL is safe to redirect to
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if the URL is safe, false otherwise
 */
function isSafeRedirectUrl(url) {
  // If no URL provided, it's not safe
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Empty string or just "/" is always safe (relative path)
  if (url === '' || url === '/') {
    return true;
  }

  // Check for relative paths (starting with / but not //)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  // Check for absolute URLs - must be in trusted domains
  try {
    const parsedUrl = new URL(url);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Get the hostname without www prefix for comparison
    const hostname = parsedUrl.hostname.replace(/^www\./, '');
    
    // Check against trusted domains (also without www)
    return TRUSTED_DOMAINS.some(trusted => 
      trusted.replace(/^www\./, '') === hostname
    );
  } catch (e) {
    // Invalid URL format
    return false;
  }
}

// POST route for login with returnTo parameter
router.post('/login', (req, res) => {
  const { username, password, returnTo } = req.body;
  
  // Perform authentication logic here (simplified)
  if (username === 'admin' && password === 'password123') {
    // Set session or JWT token as needed
    req.session.userId = username;
    
    // Validate and redirect to safe URL
    if (returnTo && isSafeRedirectUrl(returnTo)) {
      return res.redirect(returnTo);
    } else {
      // Default redirect if no valid returnTo parameter
      return res.redirect('/');
    }
  } else {
    // Authentication failed
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET route to show login form (optional)
router.get('/login', (req, res) => {
  const { returnTo } = req.query;
  
  // Render login page with returnTo parameter preserved
  res.render('login', { 
    returnTo: isSafeRedirectUrl(returnTo) ? returnTo : '' 
  });
});

module.exports = router;