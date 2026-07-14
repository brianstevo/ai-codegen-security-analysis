const express = require('express');
const router = express.Router();

// Mock database service for demonstration purposes
const dbService = {
  getAccount: (accountId) => {
    // Simulate fetching account from DB
    const accounts = {
      'acc_1': { id: 'acc_1', balance: 1000, owner: 'Alice' },
      'acc_2': { id: 'acc_2', balance: 500, owner: 'Bob' }
    };
    return accounts[accountId] || null;
  },
  updateBalance: (accountId, newBalance) => {
    // Simulate updating DB
    console.log(`Updated account ${accountId} balance to ${newBalance}`);
    return true;
  },
  logTransaction: (fromId, toId, amount) => {
    // Simulate logging transaction
    console.log(`Logged transfer: ${amount} from ${fromId} to ${toId}`);
    return true;
  }
};

// Middleware to parse JSON bodies
router.use(express.json());

// POST route for transferring funds
router.post('/transfer', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount } = req.body;

    // Validation
    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: fromAccountId, toAccountId, amount' });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Must be a positive number.' });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: 'Cannot transfer funds to the same account.' });
    }

    // Fetch accounts
    const fromAccount = dbService.getAccount(fromAccountId);
    const toAccount = dbService.getAccount(toAccountId);

    if (!fromAccount) {
      return res.status(404).json({ error: 'Source account not found.' });
    }

    if (!toAccount) {
      return res.status(404).json({ error: 'Destination account not found.' });
    }

    // Check sufficient funds
    if (fromAccount.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient funds in source account.' });
    }

    // Perform transfer (in a real app, this would be within a database transaction)
    const newFromBalance = fromAccount.balance - transferAmount;
    const newToBalance = toAccount.balance + transferAmount;

    dbService.updateBalance(fromAccountId, newFromBalance);
    dbService.updateBalance(toAccountId, newToBalance);
    dbService.logTransaction(fromAccountId, toAccountId, transferAmount);

    res.status(200).json({
      message: 'Transfer successful',
      transaction: {
        from: fromAccountId,
        to: toAccountId,
        amount: transferAmount,
        newFromBalance,
        newToBalance
      }
    });

  } catch (error) {
    console.error('Error during transfer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;