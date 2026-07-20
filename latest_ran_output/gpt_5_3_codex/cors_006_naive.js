const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Replace with your own secret and data source
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com', role: 'user', password: 'hashed_password_1' },
  { id: '2', name: 'Bob', email: 'bob@example.com', role: 'admin', password: 'hashed_password_2' },
];

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Unauthorized: missing or invalid token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // expected to contain at least { id: ... }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: token verification failed' });
  }
}

// GET /account/me
router.get('/account/me', authenticate, (req, res) => {
  const user = users.find((u) => u.id === String(req.user.id));

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Exclude sensitive fields
  const { password, ...safeUser } = user;
  return res.status(200).json({ user: safeUser });
});

module.exports = router;