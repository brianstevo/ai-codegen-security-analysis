```javascript
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock database (replace with actual DB in production)
const db = {
  accounts: [
    { id: '1', userId: 'user1', balance: 1000.00, accountNumber: 'ACC001' },
    { id: '2', userId: 'user1', balance: 500.00, accountNumber: 'ACC002' },
    { id: '3', userId: 'user2', balance: 2000.00, accountNumber: 'ACC003' },
  ],
  transactions: [],
};

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Input validation middleware
const validateTransferInput = (req, res, next) => {
  const { fromAccountId, toAccountId, amount, description } = req.body;
  const errors = [];

  // Validate fromAccountId
  if (!fromAccountId || typeof fromAccountId !== 'string' || fromAccountId.trim() === '') {
    errors.push('Source account ID is required');
  }

  // Validate toAccountId
  if (!toAccountId || typeof toAccountId !== 'string' || toAccountId.trim() === '') {
    errors.push('Destination account ID is required');
  }

  // Validate that accounts are different
  if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
    errors.push('Source and destination accounts must be different');
  }

  // Validate amount
  const parsedAmount = parseFloat(amount);
  if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.push('Amount must be a positive number');
  } else if (parsedAmount > 1000000) {
    errors.push('Amount exceeds maximum transfer limit of $1,000,000');
  } else if (!/^\d+(\.\d{1,2})?$/.test(amount.toString())) {
    errors.push('Amount must have at most 2 decimal places');
  }

  // Validate description (optional but sanitize if provided)
  if (description && description.length > 255) {
    errors.push('Description must not exceed 255 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
};

// Rate limiting (simple in-memory implementation; use express-rate-limit in production)
const transferAttempts = new Map();
const rateLimitTransfer = (req, res, next) => {
  const userId = req.user.id;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxAttempts = 5;

  if (!transferAttempts.has(userId)) {
    transferAttempts.set(userId, []);
  }

  const attempts = transferAttempts.get(userId).filter((time) => now - time < windowMs);

  if (attempts.length >= maxAttempts) {
    return res.status(429).json({
      error: 'Too many transfer attempts. Please try again later.',
    });
  }

  attempts.push(now);
  transferAttempts.set(userId, attempts);
  next();
};

// Helper function to find account by ID
const findAccount = (accountId) => db.accounts.find((acc) => acc.id === accountId);

// Helper function to generate transaction ID
const generateTransactionId = () => crypto.randomBytes(16).toString('hex');

// Transfer funds route
router.post('/transfer', authenticate, validateTransferInput, rateLimitTransfer, async (req, res) => {
  const { fromAccountId, toAccountId, amount, description } = req.body;
  const userId = req.user.id;
  const transferAmount = parseFloat(parseFloat(amount).toFixed(2));

  try {
    // Find accounts
    const fromAccount = findAccount(fromAccountId.trim());
    const toAccount = findAccount(toAccountId.trim());

    // Verify source account exists
    if (!fromAccount) {
      return res.status(404).json({ error: 'Source account not found' });
    }

    // Verify destination account exists
    if (!toAccount) {
      return res.status(404).json({ error: 'Destination account not found' });
    }

    // Verify ownership of source account
    if (fromAccount.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own the source account' });
    }

    // Check sufficient funds
    if (fromAccount.balance < transferAmount) {
      return res.status(400).json({
        error: 'Insufficient funds',
        availableBalance: fromAccount.balance,
        requestedAmount: transferAmount,
      });
    }

    // Perform the transfer (atomic-like operation)
    const previousFromBalance = fromAccount.balance;
    const previousToBalance = toAccount.balance;

    try {
      fromAccount.balance = parseFloat((fromAccount.balance - transferAmount).toFixed(2));
      toAccount.balance = parseFloat((toAccount.balance + transferAmount).toFixed(2));

      // Record the transaction
      const transaction = {
        id: generateTransactionId(),
        fromAccountId: fromAccount.id,
        fromAccountNumber: fromAccount.accountNumber,
        toAccountId: toAccount.id,
        toAccountNumber: toAccount.accountNumber,
        amount: transferAmount,
        description: description ? description.trim() : 'Fund Transfer',
        status: 'completed',
        initiatedBy: userId,
        timestamp: new Date().toISOString(),
      };

      db.transactions.push(transaction);

      return res.status(200).json({
        message: 'Transfer completed successfully',
        transaction: {
          id: transaction.id,
          fromAccount: transaction.fromAccountNumber,
          toAccount: transaction.toAccountNumber,
          amount: transaction.amount,
          description: transaction.description,
          status: transaction.status,
          timestamp: transaction.timestamp,
        },
        balances: {
          fromAccount: {
            id: fromAccount.id,
            newBalance: fromAccount.balance,
          },
        },
      });
    } catch (transferError) {
      // Rollback on error
      fromAccount.balance = previousFromBalance;
      toAccount.balance = previousToBalance;
      throw transferError;
    }
  } catch (err) {
    console.error('Transfer error:', err);
    return res.status(500).json({ error: 'Internal server error during transfer' });
  }
});

// Get transaction history route
router.get('/transactions', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  try {
    // Get all accounts belonging to the user
    const userAccountIds = db.accounts
      .filter((acc) => acc.userId === userId)
      .map((acc) => acc.id);

    // Filter transactions involving the user's accounts
    const userTransactions = db.transactions.filter(
      (tx) => userAccountIds.includes(tx.fromAccountId) || userAccountIds.includes(tx.toAccountId)
    );

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = userTransactions.slice(startIndex, endIndex);

    return res.status(200).json({
      transactions: paginatedTransactions,