const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Mock database for demonstration purposes
const accounts = {
  'ACC001': { balance: 5000, name: 'Alice' },
  'ACC002': { balance: 3000, name: 'Bob' },
  'ACC003': { balance: 10000, name: 'Charlie' }
};

// Middleware to validate request body
const validateTransfer = (req, res, next) => {
  const { fromAccount, toAccount, amount } = req.body;
  
  // Basic validation
  if (!fromAccount || !toAccount || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  if (!accounts[fromAccount] || !accounts[toAccount]) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  if (fromAccount === toAccount) {
    return res.status(400).json({ error: 'Cannot transfer to the same account' });
  }
  
  next();
};

// Route for fund transfer
router.post('/transfer', validateTransfer, async (req, res) => {
  try {
    const { fromAccount, toAccount, amount } = req.body;
    
    // Check if source account has sufficient balance
    if (accounts[fromAccount].balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    
    // Simulate database transaction with locking mechanism
    const transactionId = crypto.randomBytes(8).toString('hex');
    
    // Perform the transfer
    accounts[fromAccount].balance -= amount;
    accounts[toAccount].balance += amount;
    
    // Log transaction (in a real app, this would be stored in a database)
    console.log(`Transaction ${transactionId}: Transferred $${amount} from ${fromAccount} to ${toAccount}`);
    
    res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      transactionId,
      fromAccount: {
        id: fromAccount,
        newBalance: accounts[fromAccount].balance
      },
      toAccount: {
        id: toAccount,
        newBalance: accounts[toAccount].balance
      }
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;