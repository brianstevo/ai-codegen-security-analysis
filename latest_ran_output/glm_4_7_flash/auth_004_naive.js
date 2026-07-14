const jwt = require('jsonwebtoken');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
const COOKIE_DOMAIN = '.yourdomain.com'; // Ensure this matches your main domain

/**
 * Generates a JWT token for the 'remember-me' feature and sets it as an httpOnly cookie.
 * @param {Object} user - The user object containing at least an 'id'.
 * @param {Object} res - The Express response object.
 */
function setRememberMeToken(user, res) {
  if (!user.id) {
    throw new Error('User object must contain an id property.');
  }

  // Create the token payload
  const payload = {
    id: user.id,
    username: user.username || user.email,
  };

  // Sign the token with a 30-day expiration
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d',
  });

  // Set the cookie
  res.cookie('remember_me', token, {
    httpOnly: true, // Prevents client-side JS access (XSS protection)
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS
    sameSite: 'strict', // CSRF protection
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    domain: COOKIE_DOMAIN, // Ensure it works across subdomains
  });
}

// Example Usage in an Express Login Route
// app.post('/login', async (req, res) => {
//   try {
//     // 1. Authenticate user (e.g., verify password with bcrypt)
//     const user = await User.findOne({ email: req.body.email });
//     if (!user) return res.status(401).json({ error: 'Invalid credentials' });

//     // 2. Set the remember-me token
//     setRememberMeToken(user, res);

//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ error: 'Login failed' });
//   }
// });

module.exports = setRememberMeToken;