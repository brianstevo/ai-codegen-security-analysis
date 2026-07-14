const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const url = require('url');

const app = express();
app.use(bodyParser.json());

// Mock user store (username => bcrypt hash)
const USERS = {
  // password: secret123
  alice: '$2b$10$KIX/6Zc8Y5eFz1G9xQ0UOeVhXvJfRkWw7r3pE2nM4jNqLzDgHcB5i',
};

const JWT_SECRET = 'your_jwt_secret';
const TRUSTED_DOMAINS = ['example.com', 'trusted.com'];

/**
 * Returns true if `target` is a relative path (e.g., "/dashboard").
 */
function isRelativePath(target) {
  try {
    // Use a dummy base to parse; if origin stays the dummy, it's relative.
    const parsed = new URL(target, 'http://placeholder');
    return parsed.origin === 'http://placeholder' && target.startsWith('/');
  } catch (_) {
    return false;
  }
}

/**
 * Returns true if `target` is an absolute URL whose hostname is whitelisted.
 */
function isWhitelistedDomain(target) {
  try {
    const parsed = new URL(target);
    return TRUSTED_DOMAINS.includes(parsed.hostname);
  } catch (_) {
    return false;
  }
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const storedHash = USERS[username];
  if (!storedHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordMatches = await bcrypt.compare(password, storedHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Issue JWT (optional)
  const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: '1h' });

  // Determine redirect target
  let { returnTo } = req.query;
  if (!returnTo) returnTo = '/';

  // Validate redirect URL
  let safeRedirect = null;
  if (isRelativePath(returnTo)) {
    safeRedirect = returnTo;
  } else if (isWhitelistedDomain(returnTo)) {
    safeRedirect = returnTo;
  }

  if (!safeRedirect) {
    return res.status(400).json({ error: 'Invalid redirect URL' });
  }

  // Set auth cookie (or header) as needed
  res.cookie('auth_token', token, { httpOnly: true, secure: true });

  // Perform safe redirect
  return res.redirect(safeRedirect);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});