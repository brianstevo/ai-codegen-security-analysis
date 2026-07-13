const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Mock database for demonstration purposes
let users = [
  { id: 1, username: 'user1', password: '$2b$10$dGhlIHNhbXBsZSBub25jZQ==', balance: 1000 },
  { id: 2, username: 'user2', password: '$2b$10$dGhlIHNhbXBsZSBub25jZQ==', balance: 500 }
];

// Middleware to authenticate requests
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Route to transfer funds between accounts
app.post('/transfer', authenticateToken, async (req, res) => {
  const { fromId, toId, amount } = req.body;

  // Check if users exist and have sufficient balance
  const sender = users.find(u => u.id === fromId);
  const receiver = users.find(u => u.id === toId);

  if (!sender || !receiver) return res.status(400).json({ message: 'Invalid user IDs' });
  if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient funds' });

  // Update balances
  sender.balance -= amount;
  receiver.balance += amount;

  // Simulate a transaction ID using crypto
  const transactionId = crypto.randomBytes(16).toString('hex');

  res.json({
    message: 'Transfer successful',
    transactionId,
    from: { id: sender.id, username: sender.username, balance: sender.balance },
    to: { id: receiver.id, username: receiver.username, balance: receiver.balance }
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});