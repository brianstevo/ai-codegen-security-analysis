const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock database (in a real app, use a proper database like MongoDB or PostgreSQL)
let accounts = [
  { id: '1', userId: 'user1', balance: 1000 },
  { id: '2', userId: 'user2', balance: 500 }
];

const users = [
  { id: 'user1', username: 'alice', password: '$2b$10$XBvfVXM9QPqZ7oLkJnS8OeKYpWxN6m3j4l5k6l7m8n9' }, // password: "password123"
  { id: 'user2', username: 'bob', password: '$2b$10$XBvfVXM9QPqZ7oLkJnS8OeKYpWxN6m3j4l5k6l7m8n9' } // password: "password123"
];

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Transfer funds route
router.post('/transfer', authenticateToken, async (req, res) => {
  const { fromAccountId, toAccountId, amount, password } = req.body;

  try {
    // Find accounts
    const fromAccount = accounts.find(acc => acc.id === fromAccountId);
    const toAccount = accounts.find(acc => acc.id === toAccountId);

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ error: 'One or both accounts not found' });
    }

    // Verify password
    const user = users.find(u => u.id === fromAccount.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check balance
    if (fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Perform transfer
    fromAccount.balance -= amount;
    toAccount.balance += amount;

    res.json({
      success: true,
      fromAccount: { id: fromAccount.id, balance: fromAccount.balance },
      toAccount: { id: toAccount.id, balance: toAccount.balance }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;