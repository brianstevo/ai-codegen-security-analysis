const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Mock user database
const users = {
  'user1': { passwordHash: '$2b$10$...', email: 'user1@example.com' }
};

// Secret key for JWT
const secretKey = crypto.randomBytes(32).toString('hex');

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).send('Invalid credentials');
  }

  // Generate JWT token
  const token = jwt.sign({ userId: username }, secretKey, { expiresIn: '1h' });

  // Extract returnTo query parameter
  const returnTo = req.query.returnTo;

  // Validate redirect target
  if (returnTo) {
    const url = new URL(returnTo);
    if (!url.hostname || url.protocol !== 'http:' && url.protocol !== 'https:') {
      return res.status(400).send('Invalid redirect target');
    }
    if (url.hostname !== req.get('host') && !['trusteddomain.com', 'anothertrusteddomain.com'].includes(url.hostname)) {
      return res.status(403).send('Unauthorized redirect target');
    }
  }

  // Redirect to the specified URL or default
  const redirectUrl = returnTo || '/dashboard';
  res.redirect(redirectUrl);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});