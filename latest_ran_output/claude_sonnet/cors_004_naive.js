```javascript
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock database (replace with actual DB in production)
const db = {
  accounts: [
    { id: '1', userId: 'user1', balance: 1000.00, currency: 'USD', accountNumber: 'ACC001' },
    { id: '2', userId: 'user1', balance: 500.00, currency: 'USD', accountNumber: 'ACC002' },
    { id: '3', userId: 'user2', balance: 2000.00, currency: 'USD', accountNumber: 'ACC003' },
  ],
  transactions: [],
};

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Input Validation Middleware
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
  if (!amount || isNaN(parsedAmount)) {
    errors.push('A valid transfer amount is required');
  } else if (parsedAmount <= 0) {
    errors.push('Transfer amount must be greater than zero');
  } else if (parsedAmount > 1000000) {
    errors.push('Transfer amount exceeds maximum limit of $1,000,000');
  } else if (!/^\d+(\.\d{1,2})?$/.test(amount.toString())) {
    errors.push('Amount must have at most 2 decimal places');
  }

  // Validate description (optional but sanitized)
  if (description && description.length > 200) {
    errors.push('Description must not exceed 200 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.transferData = {
    fromAccountId: fromAccountId.trim(),
    toAccountId: toAccountId.trim(),
    amount: parsedAmount,
    description: description ? description.trim().replace(/[<>]/g, '') : '',
  };

  next();
};

// Rate limiting (simple in-memory store; use Redis in production)
const transferAttempts = new Map();

const rateLimitTransfers = (req, res, next) => {
  const userId = req.user.id;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxAttempts = 5;

  if (!transferAttempts.has(userId)) {
    transferAttempts.set(userId, []);
  }

  const attempts = transferAttempts.get(userId).filter(time => now - time < windowMs);

  if (attempts.length >= maxAttempts) {
    return res.status(429).json({
      success: false,
      message: 'Too many transfer attempts. Please wait before trying again.',
    });
  }

  attempts.push(now);
  transferAttempts.set(userId, attempts);
  next();
};

// Helper: Find account by ID
const findAccount = (accountId) => db.accounts.find(acc => acc.id === accountId);

// Helper: Generate transaction ID
const generateTransactionId = () => `TXN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

// Helper: Log transaction
const logTransaction = (transactionId, fromAccount, toAccount, amount, status, description) => {
  const transaction = {
    id: transactionId,
    fromAccountId: fromAccount.id,
    fromAccountNumber: fromAccount.accountNumber,
    toAccountId: toAccount.id,
    toAccountNumber: toAccount.accountNumber,
    amount,
    currency: fromAccount.currency,
    status,
    description,
    timestamp: new Date().toISOString(),
  };
  db.transactions.push(transaction);
  return transaction;
};

// POST /api/transfer - Handle fund transfer
router.post('/transfer', authenticateToken, rateLimitTransfers, validateTransferInput, async (req, res) => {
  const { fromAccountId, toAccountId, amount, description } = req.transferData;
  const userId = req.user.id;
  const transactionId = generateTransactionId();

  try {
    // Find source account
    const fromAccount = findAccount(fromAccountId);
    if (!fromAccount) {
      return res.status(404).json({
        success: false,
        message: 'Source account not found',
        transactionId,
      });
    }

    // Authorization: Ensure the authenticated user owns the source account
    if (fromAccount.userId !== userId) {
      logTransaction(transactionId, fromAccount, { id: toAccountId, accountNumber: 'UNKNOWN' }, amount, 'UNAUTHORIZED', description);
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to transfer from this account',
        transactionId,
      });
    }

    // Find destination account
    const toAccount = findAccount(toAccountId);
    if (!toAccount) {
      return res.status(404).json({
        success: false,
        message: 'Destination account not found',
        transactionId,
      });
    }

    // Check currency compatibility
    if (fromAccount.currency !== toAccount.currency) {
      return res.status(400).json({
        success: false,
        message: 'Currency mismatch between accounts. Cross-currency transfers are not supported.',
        transactionId,
      });
    }

    // Check sufficient funds
    if (fromAccount.balance < amount) {
      logTransaction(transactionId, fromAccount, toAccount, amount, 'FAILED_INSUFFICIENT_FUNDS', description);
      return res.status(400).json({
        success: false,
        message: 'Insufficient funds in source account',
        availableBalance: fromAccount.balance,
        requestedAmount: amount,
        transactionId,
      });
    }

    // Perform the transfer (atomic operation)
    fromAccount.balance = parseFloat((fromAccount.balance - amount).toFixed(2));
    toAccount.balance = parseFloat((toAccount.balance + amount).toFixed(2));

    // Log the successful transaction
    const transaction = logTransaction(transactionId, fromAccount, toAccount, amount, 'SUCCESS', description);

    // Respond with success
    return res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      transaction: {
        id: transaction.id,
        fromAccount: {
          id: fromAccount.id,
          accountNumber: fromAccount.accountNumber,
          newBalance: fromAccount.balance,
          currency: fromAccount.currency,
        },
        toAccount: {
          id: toAccount.id,
          accountNumber: toAccount.accountNumber,
          newBalance: toAccount.balance,
          currency: toAccount.currency,
        },
        amount: transaction.amount,