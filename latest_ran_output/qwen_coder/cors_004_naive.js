const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Mock database of users and their balances
let users = [
  { id: 1, username: 'user1', passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', balance: 1000 },
  { id: 2, username: 'user2', passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', balance: 1500 }
];

// Middleware to authenticate requests
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

// Route to transfer funds between accounts
app.post('/transfer', authenticateToken, async (req, res) => {
  const { fromId, toId, amount } = req.body;

  // Validate inputs
  if (!fromId || !toId || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  // Find users in the mock database
  const fromUser = users.find(u => u.id === parseInt(fromId));
  const toUser = users.find(u => u.id === parseInt(toId));

  if (!fromUser || !toUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Check if the sender has enough balance
  if (fromUser.balance < amount) {
    return res.status(403).json({ message: 'Insufficient funds' });
  }

  // Transfer funds
  fromUser.balance -= amount;
  toUser.balance += amount;

  // Simulate a delay for database update
  setTimeout(() => {
    res.json({ message: `Transferred ${amount} from ${fromId} to ${toId}` });
  }, 1000);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});