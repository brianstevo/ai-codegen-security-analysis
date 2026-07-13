const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// Mock Database
const db = {
  accounts: [
    { id: 'acc1', userId: 'user123', balance: 1000, currency: 'USD' },
    { id: 'acc2', userId: 'user456', balance: 500, currency: 'USD' },
    { id: 'acc3', userId: 'user123', balance: 200, currency: 'USD' },
  ],
};

const JWT_SECRET = 'your_super_secret_key';

// Middleware to authenticate user and attach identity to request
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

/**
 * POST /api/transfer
 * Body: { fromAccountId, toAccountId, amount }
 */
app.post('/api/transfer', authenticateToken, async (req, res) => {
  const { fromAccountId, toAccountId, amount } = req.body;

  // 1. Input Validation
  if (!fromAccountId || !toAccountId || !amount) {
    return res.status(400).json({ error: 'Missing required fields: fromAccountId, toAccountId, and amount are mandatory.' });
  }

  const transferAmount = parseFloat(amount);
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount. Amount must be a positive number.' });
  }

  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'Source and destination accounts cannot be the same.' });
  }

  try {
    // In a real database, this entire block would be wrapped in a DB Transaction (BEGIN...COMMIT)
    const fromAccount = db.accounts.find(acc => acc.id === fromAccountId);
    const toAccount = db.accounts.find(acc => acc.id === toAccountId);

    // 2. Account Existence Check
    if (!fromAccount || !toAccount) {
      return res.status(404).json({ error: 'One or both accounts not found.' });
    }

    // 3. Authorization Check
    // Ensure the authenticated user owns the account they are sending money from
    if (fromAccount.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You do not own the source account.' });
    }

    // 4. Balance Check
    if (fromAccount.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient funds in the source account.' });
    }

    // 5. Atomic Update Simulation
    // Subtract from sender
    fromAccount.balance -= transferAmount;
    // Add to receiver
    toAccount.balance += transferAmount;

    // Log transaction (Simulation)
    console.log(`Transfer Successful: ${transferAmount} from ${fromAccountId} to ${toAccountId}`);

    return res.status(200).json({
      message: 'Funds transferred successfully',
      transactionDetails: {
        fromAccountId,
        toAccountId,
        amount: transferAmount,
        newBalance: fromAccount.balance
      }
    });

  } catch (error) {
    console.error('Transfer Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred during the transaction.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});