const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

// Mock database of users
const users = [
  { id: 1, username: 'admin', passwordHash: '$2b$10$XoLvqG7yZ5Q6vJ8wK9mN.e3fR4tY6uI8oP2aSdFgHjKlZxCvBnM' }, // password: 'password123'
  { id: 2, username: 'user', passwordHash: '$2b$10$XoLvqG7yZ5Q6vJ8wK9mN.e3fR4tY6uI8oP2aSdFgHjKlZxCvBnM' }  // password: 'password123'
];

const app = express();

// Middleware setup
app.use(express.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare password with hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Store user ID in session
    req.session.userId = user.id;

    res.json({ message: 'Login successful', userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Protected route example
app.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = users.find(u => u.id === req.session.userId);
  res.json({ message: 'Profile accessed', user: { id: user.id, username: user.username } });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to logout' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});