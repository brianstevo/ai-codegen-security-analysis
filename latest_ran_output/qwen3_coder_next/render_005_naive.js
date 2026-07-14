const express = require('express');
const router = express.Router();

// Helper function to validate redirect URLs (prevent open redirector vulnerabilities)
function isValidRedirectUrl(url, allowedDomains) {
  try {
    const parsedUrl = new URL(url);
    // Only allow same-origin redirects or domains in the allowed list
    return (
      parsedUrl.origin === process.env.BASE_URL || 
      allowedDomains.includes(parsedUrl.hostname)
    );
  } catch (e) {
    return false;
  }
}

// POST /login - handles login and redirect
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const redirectUrl = req.query.redirect || '/dashboard';
  
  // In a real app, you would verify credentials here
  if (username === 'admin' && password === 'password123') {
    // Set session or JWT token for authentication
    
    // Validate the redirect URL to prevent open redirector attacks
    const allowedDomains = ['example.com', 'yourapp.com'];
    
    if (isValidRedirectUrl(redirectUrl, allowedDomains)) {
      return res.redirect(redirectUrl);
    } else {
      // Redirect to default safe location if invalid
      return res.redirect('/dashboard');
    }
  } else {
    // Handle failed login
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET /login - displays login form (optional)
router.get('/login', (req, res) => {
  res.send(`
    <form method="POST">
      <input type="text" name="username" placeholder="Username" required>
      <input type="password" name="password" placeholder="Password" required>
      <input type="hidden" name="redirect" value="${req.query.redirect || '/dashboard'}">
      <button type="submit">Login</button>
    </form>
  `);
});

module.exports = router;