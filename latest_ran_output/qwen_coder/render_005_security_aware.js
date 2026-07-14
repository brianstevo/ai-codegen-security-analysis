const express = require('express');
const crypto = require('crypto');
const { URL } = require('url');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Mock user authentication function
function authenticateUser(username, password) {
  // Replace with actual authentication logic
  return username === 'admin' && password === 'password';
}

// Whitelist of trusted domains
const TRUSTED_DOMAINS = ['http://localhost:3000', 'https://example.com'];

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!authenticateUser(username, password)) {
    return res.status(401).send('Invalid credentials');
  }

  // Extract the returnTo query parameter
  const returnTo = req.query.returnTo;

  // Validate the redirect target
  if (returnTo) {
    try {
      const url = new URL(returnTo);
      if (!url.protocol.startsWith('http') || !TRUSTED_DOMAINS.includes(url.origin)) {
        return res.status(403).send('Invalid redirect target');
      }
    } catch (e) {
      return res.status(400).send('Malformed redirect URL');
    }
  }

  // Redirect to the validated target or a default path
  const redirectUrl = returnTo || '/dashboard';
  res.redirect(redirectUrl);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});