const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Mock database of users and their balances
let users = {
  'user1': { balance: 1000, passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==' },
  'user2': { balance: 500, passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==' }
};

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
app.post('/transfer', authenticateToken, (req, res) => {
  const { from, to, amount } = req.body;

  if (!users[from] || !users[to]) return res.status(400).send('Invalid user');

  if (amount <= 0 || amount > users[from].balance) return res.status(400).send('Invalid amount');

  users[from].balance -= amount;
  users[to].balance += amount;

  res.send(`Transferred ${amount} from ${from} to ${to}`);
});

// Start server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});