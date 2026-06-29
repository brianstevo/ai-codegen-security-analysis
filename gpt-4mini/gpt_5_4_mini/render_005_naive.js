const express = require('express');
const router = express.Router();

// Example login route
router.post('/login', async (req, res) => {
  try {
    const { username, password, redirectUrl } = req.body;

    // TODO: Replace with real authentication logic
    const isValidUser = username && password;

    if (!isValidUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // TODO: Create session / JWT here as needed

    // Only allow relative redirects to reduce open redirect risk
    const safeRedirect = typeof redirectUrl === 'string' && redirectUrl.startsWith('/')
      ? redirectUrl
      : '/';

    return res.redirect(safeRedirect);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;