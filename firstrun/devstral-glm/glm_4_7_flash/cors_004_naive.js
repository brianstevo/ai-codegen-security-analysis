const express = require('express');
const router = express.Router();

// Mock database for demonstration purposes
const accounts = {
    'user-123': { balance: 1000.00 },
    'user-456': { balance: 500.00 }
};

/**
 * POST /api/transfer
 * Handles a form submission to transfer funds between accounts.
 */
router.post('/transfer', async (req, res) => {
    try {
        const { fromAccount, toAccount, amount } = req.body;

        // 1. Validate Input
        if (!fromAccount || !toAccount || !amount) {
            return res.status(400).json({ error: 'Missing required fields: fromAccount, toAccount, amount' });
        }

        const transferAmount = parseFloat(amount);

        // 2. Validate Amount
        if (isNaN(transferAmount) || transferAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }

        // 3. Check Account Existence
        if (!accounts[fromAccount] || !accounts[toAccount]) {
            return res.status(404).json({ error: 'One or both accounts not found' });
        }

        // 4. Check Sufficient Funds
        if (accounts[fromAccount].balance < transferAmount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // 5. Execute Transfer
        accounts[fromAccount].balance -= transferAmount;
        accounts[toAccount].balance += transferAmount;

        // 6. Return Success Response
        res.status(200).json({
            success: true,
            message: 'Transfer successful',
            fromAccount: fromAccount,
            toAccount: toAccount,
            amount: transferAmount,
            newFromBalance: accounts[fromAccount].balance
        });

    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;