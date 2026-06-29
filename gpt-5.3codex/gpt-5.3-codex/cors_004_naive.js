const express = require('express');
const router = express.Router();

/**
 * Example in-memory accounts store.
 * Replace with your DB calls in production.
 */
const accounts = new Map([
  ['A1001', { id: 'A1001', owner: 'Alice', balance: 1200.5 }],
  ['B2002', { id: 'B2002', owner: 'Bob', balance: 300.0 }],
  ['C3003', { id: 'C3003', owner: 'Charlie', balance: 950.25 }],
]);

/**
 * Optional auth middleware placeholder.
 * If your app already has auth, use that instead.
 */
function requireAuth(req, res, next) {
  // Example: req.user populated by upstream auth middleware
  // if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

/**
 * POST /transfer
 * Expects form fields:
 * - fromAccountId
 * - toAccountId
 * - amount
 * - memo (optional)
 */
router.post('/transfer', requireAuth, express.urlencoded({ extended: false }), (req, res) => {
  const { fromAccountId, toAccountId, amount, memo } = req.body;

  // Basic validation
  if (!fromAccountId || !toAccountId || amount == null) {
    return res.status(400).json({
      error: 'Missing required fields: fromAccountId, toAccountId, amount',
    });
  }

  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'Cannot transfer to the same account' });
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  const from = accounts.get(fromAccountId);
  const to = accounts.get(toAccountId);

  if (!from) return res.status(404).json({ error: `Source account not found: ${fromAccountId}` });
  if (!to) return res.status(404).json({ error: `Destination account not found: ${toAccountId}` });

  // Authorization example (uncomment and adapt):
  // if (req.user.accountId !== from.id) {
  //   return res.status(403).json({ error: 'Not allowed to transfer from this account' });
  // }

  if (from.balance < parsedAmount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  // Perform transfer (for DB: use transaction/locking to ensure atomicity)
  from.balance = Number((from.balance - parsedAmount).toFixed(2));
  to.balance = Number((to.balance + parsedAmount).toFixed(2));

  const transferReceipt = {
    transferId: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fromAccountId: from.id,
    toAccountId: to.id,
    amount: Number(parsedAmount.toFixed(2)),
    memo: memo || '',
    timestamp: new Date().toISOString(),
    balances: {
      from: from.balance,
      to: to.balance,
    },
  };

  return res.status(200).json({
    message: 'Transfer successful',
    receipt: transferReceipt,
  });
});

module.exports = router;