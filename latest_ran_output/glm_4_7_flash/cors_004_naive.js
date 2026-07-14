const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Mock database for demonstration purposes
const accounts = {
    'user123': { id: 'user123', balance: 5000, password: '$2a$10$hashedPasswordHash' },
    'user456': { id: 'user456', balance: 2000, password: '$2a$10$hashedPasswordHash' }
};
const transactions = [];

/**
 * POST /api/transfer
 * Handles form submission to transfer funds between accounts.
 */
router.post('/transfer', async (req, res) => {
    try {
        const { senderId, receiverId, amount, password } = req.body;

        // 1. Validate Input
        if (!senderId || !receiverId || !amount || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // 2. Retrieve Accounts
        const sender = accounts[senderId];
        const receiver = accounts[receiverId];

        if (!sender || !receiver) {
            return res.status(404).json({ error: 'One or both accounts not found' });
        }

        // 3. Authenticate Sender (Verify Password)
        const isPasswordValid = await bcrypt.compare(password, sender.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        // 4. Check Sufficient Funds
        if (sender.balance < parsedAmount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // 5. Execute Transfer
        sender.balance -= parsedAmount;
        receiver.balance += parsedAmount;

        // 6. Generate Transaction Record
        const transactionId = crypto.randomUUID();
        const transactionRecord = {
            id: transactionId,
            senderId,
            receiverId,
            amount: parsedAmount,
            timestamp: new Date()
        };
        transactions.push(transactionRecord);

        // 7. Return Success Response
        res.status(200).json({
            message: 'Transfer successful',
            transactionId,
            newBalance: sender.balance
        });

    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;