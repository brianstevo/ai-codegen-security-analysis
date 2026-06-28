// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const url = require('url');

const app = express();
app.use(bodyParser.json());

// Mock user store (replace with real DB)
const users = [
  {
    id: 1,
    username: 'alice',
    // password is "password123"
    passwordHash: '$2b$10$KIX/6Vh3YkZcJ9G8e0xU5O7sXfHjWzDgQpEwFvBq1aL4yR9N9lM2u',
  },
];

// JWT secret (store securely!)
const JWT_SECRET = 'your_jwt_secret_key';

// Whitelisted redirect hosts (empty array means only relative URLs allowed)
const WHITELISTED_HOSTS = []; // e.g., ['example.com', 'app.example.org']

/**
 * Validate the redirect URL.
 * Allows:
// - Relative paths starting with '/' (e.g., '/dashboard')
// - Absolute URLs whose hostname is whitelisted
 */
function getSafeRedirect(redirect) {
  if (!redirect) return '/';

  try {
    const parsed = new url.URL(redirect, `http://${req.headers.host}`);
    // If the URL is relative (no protocol/host), parsed.origin will be 'null' in Node < v20,
    // but using base ensures we get a proper object.
    if (!parsed.protocol || parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      // Absolute URL?
      if (parsed.host && parsed.hostname) {
        // Check whitelist
        if (
          WHITELISTED_HOSTS.length === 0 ||
          WHITELISTED_HOSTS.includes(parsed.hostname)
        ) {
          return redirect;
        }
        // Not whitelisted -> fallback
        return '/';
      } else {
        // Relative path (e.g., '/dashboard')
        if (redirect.startsWith('/')) {
          return redirect;
        }
      }
    }
  } catch (_) {
    // Invalid URL, ignore
  }
  return '/';
}

// Login route: POST /login?redirect=/some/path
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const redirectParam = req.query.redirect;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  // Find user
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Verify password
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Create JWT (you might store it in a cookie or send as response)
  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '1h',
  });

  // Set token as HttpOnly cookie (optional)
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Determine safe redirect URL
  const safeRedirect = getSafeRedirect(redirectParam);

  // Redirect the user
  return res.redirect(safeRedirect);
});

// Example protected route to test JWT (optional)
app.get('/protected', (req, res) => {
  const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ message: `Hello ${payload.username}, you accessed a protected route!` });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));