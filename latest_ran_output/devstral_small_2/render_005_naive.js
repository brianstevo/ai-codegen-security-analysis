const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock user database
const users = [
  { id: 1, username: 'user1', password: '$2b$10$XBvNkLgZxQ3aYJ4eZmVqOeWxYhZlMmNnPpQqRrSsTtUuVvWwXxYyZz' } // hashed password for "password123"
];

// Login route
router.post('/login', async (req, res) => {
  const { username, password, redirectUrl } = req.body;

  try {
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '1h' });

    // Redirect to the provided URL with token as query parameter
    res.redirect(`${redirectUrl}?token=${token}`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;