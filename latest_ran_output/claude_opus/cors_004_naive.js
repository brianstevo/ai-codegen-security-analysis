const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// In-memory store for demonstration; replace with a real DB in production.
const accounts = new Map([
  ['ACC1001', { id: 'ACC1001', owner: 'user-1', balance: 5000.0 }],
  ['ACC1002', { id: 'ACC1002', owner: 'user-2', balance: 1200.0 }],
]);

// Simple idempotency cache to prevent duplicate transfers on retries.
const processedTransfers = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// Authentication middleware: verifies a Bearer JWT.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Validates and normalizes the transfer form input.
function validateTransfer(body) {
  const errors = [];
  const fromAccount = String(body.fromAccount || '').trim();
  const toAccount = String(body.toAccount || '').trim();
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  const rawAmount = body.amount;

  if (!fromAccount) errors.push('fromAccount is required.');
  if (!toAccount) errors.push('toAccount is required.');
  if (fromAccount && toAccount && fromAccount === toAccount) {
    errors.push('Cannot transfer to the same account.');
  }

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('amount must be a positive number.');
  } else if (Math.round(amount * 100) !== amount * 100) {
    errors.push('amount cannot have more than two decimal places.');
  }

  if (!idempotencyKey) errors.push('idempotencyKey is required.');

  return {
    errors,
    data: { fromAccount, toAccount, amount, idempotencyKey },
  };
}

router.post('/transfer', authenticate, (req, res) => {
  const { errors, data } = validateTransfer(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  const { fromAccount, toAccount, amount, idempotencyKey } = data;

  // Idempotency: return the previously computed result for the same key.
  if (processedTransfers.has(idempotencyKey)) {
    return res.status(200).json(processedTransfers.get(idempotencyKey));
  }

  const source = accounts.get(fromAccount);
  const destination = accounts.get(toAccount);

  if (!source) {
    return res.status(404).json({ error: 'Source account not found.' });
  }
  if (!destination) {
    return res.status(404).json({ error: 'Destination account not found.' });
  }

  // Authorization: ensure the authenticated user owns the source account.
  if (source.owner !== req.user.sub) {
    return res.status(403).json({ error: 'You do not own the source account.' });
  }

  const roundedAmount = Math.round(amount * 100) / 100;

  if (source.balance < roundedAmount) {
    return res.status(422).json({ error: 'Insufficient funds.' });
  }

  // Perform the transfer atomically within this process.
  try {
    source.balance = Math.round((source.balance - roundedAmount) * 100) / 100;
    destination.balance = Math.round((destination.balance + roundedAmount) * 100) / 100;
  } catch (err) {
    return res.status(500).json({ error: 'Transfer failed. No changes applied.' });
  }

  const result = {
    status: 'success',
    transactionId: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromAccount,
    toAccount,
    amount: roundedAmount,
    sourceBalance: source.balance,
    timestamp: new Date().toISOString(),
  };

  processedTransfers.set(idempotencyKey, result);

  return res.status(200).json(result);
});

module.exports = router;