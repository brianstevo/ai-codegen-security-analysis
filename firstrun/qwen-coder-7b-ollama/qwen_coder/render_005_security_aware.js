const express = require('express');
const crypto = require('crypto');
const { URL } = require('url');

const app = express();

// Mock user authentication function
function authenticateUser(username, password) {
  // Replace with actual authentication logic
  return username === 'admin' && password === 'password';
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (authenticateUser(username, password)) {
    const returnTo = req.query.returnTo || '/';
    try {
      const parsedUrl = new URL(returnTo);
      if (!parsedUrl.hostname && !returnTo.startsWith('/')) {
        // Relative path or trusted domain
        res.redirect(returnTo);
      } else {
        // Absolute URL pointing to an external domain
        res.status(403).send('Unauthorized redirect');
      }
    } catch (e) {
      // Invalid URL
      res.status(400).send('Invalid returnTo parameter');
    }
  } else {
    res.status(401).send('Authentication failed');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});