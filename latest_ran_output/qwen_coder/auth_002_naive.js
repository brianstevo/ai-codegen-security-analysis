const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock database of users
let users = [
  { id: 1, username: 'user1', passwordHash: '$2b$10$dGhlIHNhbXBsZSBub25jZQ==' } // Password is 'password'
];

// Middleware to check if user is authenticated
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (user && await bcrypt.compare(password, user.passwordHash)) {
    const accessToken = jwt.sign({ id: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  } else {
    res.sendStatus(401);
  }
});

// Protected route
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: `Welcome back, user ${req.user.id}!` });
});

app.listen(3000, () => console.log('Server is running on port 3000'));