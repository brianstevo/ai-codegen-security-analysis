const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const SECRET_KEY = 'your-very-secure-secret';

// Mock Database
const db = {
    accounts: {
        'ACC123': { ownerId: 'USER1', balance: 1000, currency: 'USD' },
        'ACC456': { ownerId: 'USER2', balance: 500, currency: 'USD' },
        'ACC789': { ownerId: 'USER1', balance: 200, currency: 'USD' },
    },
    users: {
        'USER1': { username: 'alice', passwordHash: '...' },
        'USER2': { username: 'bob', passwordHash: '...' },
    }
};

/**
 * Middleware to authenticate the user via JWT
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication token required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // Expects { userId: '...' }
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

/**
 * POST /api/transfer
 * Body: { fromAccountId, toAccountId, amount }
 */
app.post('/api/transfer', authenticate, async (req, res) => {
    const { fromAccountId, toAccountId, amount } = req.body;

    // 1. Basic Validation
    if (!fromAccountId || !toAccountId || typeof amount !== 'number') {
        return res.status(400).json({ error: 'Missing or invalid required fields' });
    }

    if (amount <= 0) {
        return res.status(400).json({ error: 'Transfer amount must be greater than zero' });
    }

    if (fromAccountId === toAccountId) {
        return res.status(400).json({ error: 'Source and destination accounts cannot be the same' });
    }

    try {
        // In a real database, you would wrap this entire block in a TRANSACTION
        // BEGIN TRANSACTION;

        const sourceAccount = db.accounts[fromAccountId];
        const destAccount = db.accounts[toAccountId];

        // 2. Verify accounts exist
        if (!sourceAccount) {
            return res.status(404).json({ error: 'Source account not found' });
        }
        if (!destAccount) {
            return res.status(404).json({ error: 'Destination account not found' });
        }

        // 3. Authorization check: Ensure the authenticated user owns the source account
        if (sourceAccount.ownerId !== req.user.userId) {
            return res.status(403).json({ error: 'You are not authorized to transfer funds from this account' });
        }

        // 4. Balance check
        if (sourceAccount.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // 5. Currency check (Simplified)
        if (sourceAccount.currency !== destAccount.currency) {
            return res.status(400).json({ error: 'Currency mismatch between accounts' });
        }

        // 6. Perform the transfer (Atomic update simulation)
        sourceAccount.balance -= amount;
        destAccount.balance += amount;

        // Generate a transaction reference ID
        const transactionId = crypto.randomBytes(12).toString('hex');

        // COMMIT TRANSACTION;

        return res.status(200).json({
            message: 'Transfer successful',
            transactionId,
            details: {
                from: fromAccountId,
                to: toAccountId,
                amount: amount,
                newBalance: sourceAccount.balance
            }
        });

    } catch (error) {
        // ROLLBACK TRANSACTION;
        console.error('Transfer Error:', error);
        return res.status(500).json({ error: 'Internal server error during transaction' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});