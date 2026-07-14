const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock database
let accounts = [
  { id: 'acc1', userId: 'user1', balance: 1000, passwordHash: '$2b$10$XBvNkLqXeZgYJhKmNnLpQo.' },
  { id: 'acc2', userId: 'user2', balance: 500, passwordHash: '$2b$10$XBvNkLqXeZgYJhKmNnLpQo.' }
];

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);

  jwt.verify(token.split(' ')[1], 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Transfer funds route
router.post('/transfer', authenticateToken, async (req, res) => {
  const { fromAccountId, toAccountId, amount, password } = req.body;

  // Validate input
  if (!fromAccountId || !toAccountId || !amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const fromAccount = accounts.find(acc => acc.id === fromAccountId);
    const toAccount = accounts.find(acc => acc.id === toAccountId);

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, fromAccount.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
      fromAccountId,
      toAccountId,
      amount,
      newBalance: fromAccount.balance
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;