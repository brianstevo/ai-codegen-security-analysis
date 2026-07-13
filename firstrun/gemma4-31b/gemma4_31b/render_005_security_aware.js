const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const SECRET_KEY = 'your-very-secure-secret';
const TRUSTED_DOMAINS = ['https://trusted-partner.com', 'https://auth.myapp.com'];

// Mock User Database
const users = [
  {
    id: 1,
    username: 'admin',
    passwordHash: bcrypt.hashSync('password123', 10),
  },
];

/**
 * Validates if the provided URL is safe to redirect to.
 * Prevents Open Redirect attacks by ensuring the target is either:
 * 1. A relative path (starts with / but not //)
 * 2. An absolute URL belonging to a trusted whitelist.
 */
const isValidRedirect = (url) => {
  if (!url) return false;

  // Check if it's a relative path
  // Must start with / and NOT start with // (which is a protocol-relative absolute URL)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  // Check if the absolute URL starts with any of our trusted domains
  try {
    const parsedUrl = new URL(url);
    return TRUSTED_DOMAINS.some((domain) => {
      const trusted = new URL(domain);
      return parsedUrl.origin === trusted.origin;
    });
  } catch (e) {
    // Invalid URL format
    return false;
  }
};

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const { returnTo } = req.query;

  try {
    // 1. Authenticate User
    const user = users.find((u) => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Generate JWT
    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });

    // 3. Handle Redirection Logic
    if (returnTo) {
      if (isValidRedirect(returnTo)) {
        // Set token in a secure cookie before redirecting
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
        });
        return res.redirect(returnTo);
      } else {
        // Log the attempt and reject the redirect target for security reasons
        console.warn(`Blocked potential open redirect to: ${returnTo}`);
        return res.status(400).json({ error: 'Invalid redirection target' });
      }
    }

    // Default response if no returnTo is provided
    res.json({ message: 'Login successful', token });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));