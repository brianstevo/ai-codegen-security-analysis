const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Mock database for demonstration purposes
const accounts = {
  'ACC001': { balance: 5000, name: 'Alice' },
  'ACC002': { balance: 3000, name: 'Bob' }
};

// Middleware to validate request body
function validateTransferRequest(req, res, next) {
  const { fromAccount, toAccount, amount } = req.body;

  // Basic validation
  if (!fromAccount || !toAccount || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Missing required fields or invalid data type' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }

  if (!accounts[fromAccount] || !accounts[toAccount]) {
    return res.status(404).json({ error: 'One or both accounts not found' });
  }

  if (fromAccount === toAccount) {
    return res.status(400).json({ error: 'Cannot transfer funds to the same account' });
  }

  req.validatedData = { fromAccount, toAccount, amount };
  next();
}

// Transfer route
router.post('/transfer', validateTransferRequest, (req, res) => {
  const { fromAccount, toAccount, amount } = req.validatedData;

  // Simulate database transaction with locking mechanism
  try {
    if (accounts[fromAccount].balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Perform the transfer
    accounts[fromAccount].balance -= amount;
    accounts[toAccount].balance += amount;

    // Generate transaction ID
    const transactionId = `TXN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const timestamp = new Date().toISOString();

    res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      transaction: {
        id: transactionId,
        fromAccount,
        toAccount,
        amount,
        timestamp
      }
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;