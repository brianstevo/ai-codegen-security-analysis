// server.js
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt'); // placeholder for password check
const session = require('express-session');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Simple in‑memory user store (replace with DB in production)
const users = [
  { id: 1, username: 'alice', passwordHash: bcrypt.hashSync('password123', 10) },
];

// Session middleware (use a proper secret and store in prod)
app.use(
  session({
    secret: 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false }, // set secure:true with HTTPS
  })
);

// Whitelisted external domains for redirects (no protocol, just hostnames)
const TRUSTED_DOMAINS = new Set(['example.com', 'trusted.com']);

/**
 * Validate that a redirect target is safe.
 * - Allows relative paths starting with '/' but not protocol‑relative URLs ('//')
 * - Allows absolute URLs whose hostname is in the whitelist
 * @param {string} target
 * @returns {boolean}
 */
function isValidRedirect(target) {
  if (!target) return false;

  // Disallow protocol‑relative URLs (e.g., "//evil.com")
  if (target.startsWith('//')) return false;

  // Relative path check
  if (target.startsWith('/')) {
    // Ensure it does not contain a colon before any slash to avoid "javascript:" etc.
    const colonIdx = target.indexOf(':');
    const slashIdx = target.indexOf('/');
    if (colonIdx !== -1 && colonIdx < slashIdx) return false;
    return true;
  }

  // Try parsing as absolute URL
  try {
    const urlObj = new URL(target);
    // Only allow http/https schemes
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
    // Hostname must be whitelisted (ignore port)
    return TRUSTED_DOMAINS.has(urlObj.hostname);
  } catch (_) {
    // Not a valid absolute URL
    return false;
  }
}

// Mock authentication function
async function authenticate(username, password) {
  const user = users.find((u) => u.username === username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await authenticate(username, password);

  if (!user) {
    // Authentication failed
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Store minimal session info
  req.session.userId = user.id;

  // Determine redirect target
  const returnTo = req.query.returnTo || '/';

  if (!isValidRedirect(returnTo)) {
    // Invalid or potentially unsafe redirect – fallback to home page
    return res.status(400).json({ error: 'Invalid redirect URL' });
  }

  // Safe redirect
  return res.redirect(returnTo);
});

// Example protected route
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    const loginUrl = `/login?returnTo=${encodeURIComponent(req.originalUrl)}`;
    return res.redirect(loginUrl);
  }
  res.send(`Welcome user #${req.session.userId}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));