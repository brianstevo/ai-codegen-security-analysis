const express = require('express');
const crypto = require('crypto');

const router = express.Router();

/**
 * Expected form fields:
 * - fromAccountId
 * - toAccountId
 * - amount
 * - description (optional)
 *
 * Assumes:
 * - req.user is populated by authentication middleware
 * - req.app.get('db') returns a database client/pool with transaction support
 * - accounts table has: id, user_id, balance
 * - transfers table has: id, from_account_id, to_account_id, amount, description, created_at
 */

router.post('/transfer', express.urlencoded({ extended: true }), async (req, res) => {
  const db = req.app.get('db');
  const userId = req.user && req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fromAccountId, toAccountId, amount, description } = req.body;

  if (!fromAccountId || !toAccountId || !amount) {
    return res.status(400).json({ error: 'fromAccountId, toAccountId, and amount are required' });
  }

  const transferAmount = Number(amount);

  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  if (String(fromAccountId) === String(toAccountId)) {
    return res.status(400).json({ error: 'Source and destination accounts must be different' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Lock both accounts to prevent race conditions
    const accountResult = await client.query(
      `SELECT id, user_id, balance
       FROM accounts
       WHERE id = ANY($1::int[])
       FOR UPDATE`,
      [[fromAccountId, toAccountId]]
    );

    if (accountResult.rows.length !== 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both accounts not found' });
    }

    const fromAccount = accountResult.rows.find((a) => String(a.id) === String(fromAccountId));
    const toAccount = accountResult.rows.find((a) => String(a.id) === String(toAccountId));

    if (!fromAccount || !toAccount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both accounts not found' });
    }

    // Authorization: user must own the source account
    if (String(fromAccount.user_id) !== String(userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You do not have permission to transfer from this account' });
    }

    if (Number(fromAccount.balance) < transferAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const newFromBalance = Number(fromAccount.balance) - transferAmount;
    const newToBalance = Number(toAccount.balance) + transferAmount;

    await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newFromBalance, fromAccountId]);
    await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newToBalance, toAccountId]);

    const transferId = crypto.randomUUID();

    await client.query(
      `INSERT INTO transfers (id, from_account_id, to_account_id, amount, description, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        transferId,
        fromAccountId,
        toAccountId,
        transferAmount,
        description ? String(description).slice(0, 500) : null,
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      transfer: {
        id: transferId,
        fromAccountId,
        toAccountId,
        amount: transferAmount,
        description: description || null,
      },
      balances: {
        fromAccount: newFromBalance,
        toAccount: newToBalance,
      },
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error('Transfer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;