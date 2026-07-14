const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

// Mock database of users and their balances
let users = [
  { id: 1, username: 'user1', password: '$2b$10$dGhlIHNhbXBsZSBub25jZQ==', balance: 1000 },
  { id: 2, username: 'user2', password: '$2b$10$cGFzc3dvcmQxMjM=', balance: 500 }
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

  // Check if the sender has enough balance
  const sender = users.find(u => u.id === fromId);
  if (!sender || sender.balance < amount) return res.status(400).send('Insufficient funds');

  // Deduct amount from sender's balance
  sender.balance -= amount;

  // Add amount to receiver's balance
  const receiver = users.find(u => u.id === toId);
  if (receiver) {
    receiver.balance += amount;
  } else {
    return res.status(400).send('Invalid recipient ID');
  }

  res.send(`Transferred ${amount} from account ${fromId} to account ${toId}`);
});

app.listen(3000, () => console.log('Server is running on port 3000'));