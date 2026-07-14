// server.js
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt'); // assume passwords are hashed
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Mock user store (replace with real DB)
const users = [
  {
    id: 1,
    username: 'alice',
    // password: 'password123' hashed with bcrypt
    passwordHash: '$2b$10$KIX/5YcZp6GzVh9FQeXUOeWfE0x3t8vCw7nM1gYkB4JjR6qD5aH5i',
  },
];

// Simple authentication middleware
async function authenticate(username, password) {
  const user = users.find((u) => u.username === username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}

// Helper to validate redirect URLs (allow only relative paths)
function getSafeRedirect(url) {
  try {
    // Decode and trim whitespace
    const decoded = decodeURIComponent((url || '').trim());

    // Disallow absolute URLs with protocol or host
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(decoded)) return '/';
    // Must start with '/' to be considered a safe internal path
    if (!decoded.startsWith('/')) return '/';

    // Prevent open redirect attacks via "//evil.com"
    if (decoded.startsWith('//')) return '/';

    // Normalize the path (optional)
    return decoded;
  } catch (_) {
    return '/';
  }
}

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const redirectUrl = getSafeRedirect(req.query.redirect);

  try {
    const user = await authenticate(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // TODO: set session / JWT token here
    // e.g., req.session.userId = user.id;

    // Redirect after successful login
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Example protected route to test redirection target
app.get('/dashboard', (req, res) => {
  // Placeholder auth check
  // if (!req.session.userId) return res.redirect('/login');
  res.send('Welcome to your dashboard!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));