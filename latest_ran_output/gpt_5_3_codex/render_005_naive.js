const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Mock login check (replace with real auth logic)
function authenticateUser(username, password) {
  return username === 'admin' && password === 'password123';
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const redirectTo = req.query.redirect || '/dashboard';

  if (!authenticateUser(username, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Optional: basic safety check to prevent open redirect to external domains
  // Allows only relative paths starting with "/"
  if (!redirectTo.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid redirect URL' });
  }

  return res.redirect(302, redirectTo);
});

app.get('/dashboard', (req, res) => {
  res.send('Welcome to your dashboard!');
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});