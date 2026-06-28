const express = require('express');
const router = express.Router();

// Mock database for demonstration purposes
const mockDatabase = {
    accounts: [
        { id: 1, balance: 1000 },
        { id: 2, balance: 500 }
    ]
};

router.post('/transfer', (req, res) => {
    const { fromAccountId, toAccountId, amount } = req.body;

    // Basic validation
    if (!fromAccountId || !toAccountId || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const fromAccount = mockDatabase.accounts.find(acc => acc.id === parseInt(fromAccountId));
    const toAccount = mockDatabase.accounts.find(acc => acc.id === parseInt(toAccountId));

    if (!fromAccount || !toAccount) {
        return res.status(404).json({ error: 'One or both accounts not found' });
    }

    if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be positive' });
    }

    if (fromAccount.balance < amount) {
        return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Perform transfer
    fromAccount.balance -= amount;
    toAccount.balance += amount;

    res.json({ message: 'Transfer successful', newBalances: { from: fromAccount.balance, to: toAccount.balance } });
});

module.exports = router;