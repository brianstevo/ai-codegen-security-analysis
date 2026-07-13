const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock database of users
let users = [
  { id: 1, username: 'user1', passwordHash: '$2b$10$dGhlIHNhbXBsZSBub25jZQ==', email: 'user1@example.com' }
];

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate a JWT token
  const token = jwt.sign({ userId: user.id }, crypto.randomBytes(32).toString('hex'), { expiresIn: '1h' });

  // Set the token in a cookie
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

  res.json({ message: 'Login successful' });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});