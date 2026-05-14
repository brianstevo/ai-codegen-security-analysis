const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

// Mock database of accounts
let accounts = [
  { id: '1', balance: 1000 },
  { id: '2', balance: 500 }
];

// Transfer funds route
app.post('/transfer', (req, res) => {
  const { fromAccount, toAccount, amount } = req.body;

  // Validate input
  if (!fromAccount || !toAccount || isNaN(amount)) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Find accounts in the mock database
  const sender = accounts.find(acc => acc.id === fromAccount);
  const receiver = accounts.find(acc => acc.id === toAccount);

  if (!sender || !receiver) {
    return res.status(404).json({ error: 'Account not found' });
  }

  // Check if sender has enough balance
  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  // Perform the transfer
  sender.balance -= amount;
  receiver.balance += amount;

  // Simulate a transaction ID
  const transactionId = uuidv4();

  // Return success response with transaction details
  res.json({
    message: 'Transfer successful',
    transactionId,
    fromAccount: { id: fromAccount, balance: sender.balance },
    toAccount: { id: toAccount, balance: receiver.balance }
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});