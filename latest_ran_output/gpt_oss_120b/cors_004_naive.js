// transferRoute.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Example Sequelize models (replace with your actual models)
const { sequelize, Account, Transaction } = require('./models'); // assume ./models exports initialized Sequelize instance & models

// -----------------------------------------------------------------------------
// Middleware: verify JWT and attach user info to req.user
// -----------------------------------------------------------------------------
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1]; // Expect "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET || 'supersecret', (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = payload; // e.g., { id: userId, email: ... }
    next();
  });
};

// -----------------------------------------------------------------------------
// POST /transfer
// Body: {
//   fromAccountId: string,
//   toAccountId: string,
//   amount: number (positive),
//   description?: string
// }
// -----------------------------------------------------------------------------
router.post(
  '/transfer',
  authenticate,
  [
    body('fromAccountId').isString().trim(),
    body('toAccountId').isString().trim(),
    body('amount')
      .isFloat({ gt: 0 })
      .custom((value) => Number(value).toFixed(2) === value.toString())
      .withMessage('Amount must be a positive number with up to two decimals'),
    body('description').optional().isString().trim(),
  ],
  async (req, res) => {
    // -----------------------------------------------------------------------
    // Validate request payload
    // -----------------------------------------------------------------------
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fromAccountId, toAccountId, amount, description } = req.body;
    const transferAmount = Number(parseFloat(amount).toFixed(2));

    // -----------------------------------------------------------------------
    // Basic sanity checks
    // -----------------------------------------------------------------------
    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: 'Source and destination accounts must differ' });
    }

    try {
      // -------------------------------------------------------------------
      // Run everything inside a DB transaction for atomicity
      // -------------------------------------------------------------------
      await sequelize.transaction(async (t) => {
        // Lock rows FOR UPDATE to prevent race conditions
        const fromAccount = await Account.findOne({
          where: { id: fromAccountId, userId: req.user.id },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        if (!fromAccount) {
          throw { status: 404, message: 'Source account not found or unauthorized' };
        }

        const toAccount = await Account.findOne({
          where: { id: toAccountId },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        if (!toAccount) {
          throw { status: 404, message: 'Destination account not found' };
        }

        // Ensure sufficient balance
        if (Number(fromAccount.balance) < transferAmount) {
          throw { status: 400, message: 'Insufficient funds in source account' };
        }

        // Update balances
        fromAccount.balance = Number((fromAccount.balance - transferAmount).toFixed(2));
        toAccount.balance = Number((toAccount.balance + transferAmount).toFixed(2));

        await fromAccount.save({ transaction: t });
        await toAccount.save({ transaction: t });

        // Record the transaction (you may want a separate ledger table)
        await Transaction.create(
          {
            fromAccountId,
            toAccountId,
            amount: transferAmount,
            description: description || null,
            performedByUserId: req.user.id,
            performedAt: new Date(),
          },
          { transaction: t }
        );
      });

      // -------------------------------------------------------------------
      // Success response
      // -------------------------------------------------------------------
      return res.status(200).json({
        message: 'Transfer completed successfully',
        fromAccountId,
        toAccountId,
        amount: transferAmount,
        description: description || null,
      });
    } catch (err) {
      console.error('Transfer error:', err);
      const status = err.status || 500;
      const message = err.message || 'Internal server error';
      return res.status(status).json({ error: message });
    }
  }
);

module.exports = router;