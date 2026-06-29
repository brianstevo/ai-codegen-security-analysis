const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Assumed available models/services:
// - Account: { findById, updateOne, startSession }
// - Transfer: { create }
// - authMiddleware: populates req.user with authenticated user info
// Replace these with your actual data access layer.
const Account = require('../models/Account');
const Transfer = require('../models/Transfer');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/transfer', authMiddleware, async (req, res) => {
  const { fromAccountId, toAccountId, amount, memo } = req.body;

  if (!fromAccountId || !toAccountId || amount === undefined) {
    return res.status(400).json({ error: 'fromAccountId, toAccountId, and amount are required.' });
  }

  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'Cannot transfer funds to the same account.' });
  }

  const transferAmount = Number(amount);
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  const session = await Account.startSession();
  session.startTransaction();

  try {
    const fromAccount = await Account.findById(fromAccountId).session(session);
    const toAccount = await Account.findById(toAccountId).session(session);

    if (!fromAccount) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Source account not found.' });
    }

    if (!toAccount) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Destination account not found.' });
    }

    // Optional authorization check: ensure the authenticated user owns the source account
    if (String(fromAccount.userId) !== String(req.user.id)) {
      await session.abortTransaction();
      return res.status(403).json({ error: 'You are not authorized to transfer from this account.' });
    }

    if (fromAccount.balance < transferAmount) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Insufficient funds.' });
    }

    fromAccount.balance -= transferAmount;
    toAccount.balance += transferAmount;

    await fromAccount.save({ session });
    await toAccount.save({ session });

    const transferRecord = await Transfer.create([{
      transferId: crypto.randomUUID(),
      fromAccountId,
      toAccountId,
      amount: transferAmount,
      memo: memo || '',
      initiatedBy: req.user.id,
      status: 'completed',
      createdAt: new Date()
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: 'Transfer completed successfully.',
      transfer: transferRecord[0]
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    session.endSession();

    return res.status(500).json({
      error: 'Failed to complete transfer.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;