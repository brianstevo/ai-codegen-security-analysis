const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Mock database - replace with your actual DB layer
const db = {
  accounts: new Map(),
  async getAccount(id) {
    return this.accounts.get(id) || null;
  },
  async updateBalances(fromId, toId, amount) {
    // In production, wrap this in a real DB transaction for atomicity
    const from = this.accounts.get(fromId);
    const to = this.accounts.get(toId);
    from.balance -= amount;
    to.balance += amount;
    return { from, to };
  },
  async recordTransfer(record) {
    return record;
  }
};

// In-memory idempotency store to prevent duplicate submissions
const processedTokens = new Map();

// Middleware to ensure authentication (assumes req.user set by auth layer)
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Validate and normalize the incoming transfer payload
function validateTransferInput(body) {
  const errors = [];
  const { fromAccountId, toAccountId, amount, idempotencyKey } = body;

  if (!fromAccountId || typeof fromAccountId !== 'string') {
    errors.push('fromAccountId is required');
  }
  if (!toAccountId || typeof toAccountId !== 'string') {
    errors.push('toAccountId is required');
  }
  if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
    errors.push('Cannot transfer to the same account');
  }

  // Parse amount safely; work in integer cents to avoid float errors
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    errors.push('amount must be a positive number');
  }
  const amountCents = Math.round(parsedAmount * 100);
  if (amountCents <= 0) {
    errors.push('amount is too small');
  }
  if (amountCents > 1_000_000_00) {
    errors.push('amount exceeds maximum allowed per transfer');
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    errors.push('idempotencyKey is required');
  }

  return {
    errors,
    data: {
      fromAccountId,
      toAccountId,
      amountCents,
      idempotencyKey
    }
  };
}

router.post('/transfer', requireAuth, async (req, res) => {
  try {
    const { errors, data } = validateTransferInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const { fromAccountId, toAccountId, amountCents, idempotencyKey } = data;

    // Idempotency check: return cached result if this key was seen
    if (processedTokens.has(idempotencyKey)) {
      return res.status(200).json(processedTokens.get(idempotencyKey));
    }

    const fromAccount = await db.getAccount(fromAccountId);
    const toAccount = await db.getAccount(toAccountId);

    if (!fromAccount) {
      return res.status(404).json({ error: 'Source account not found' });
    }
    if (!toAccount) {
      return res.status(404).json({ error: 'Destination account not found' });
    }

    // Authorization: ensure the authenticated user owns the source account
    if (fromAccount.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to transfer from this account' });
    }

    // Convert stored balance to cents for safe comparison
    const fromBalanceCents = Math.round(fromAccount.balance * 100);
    if (fromBalanceCents < amountCents) {
      return res.status(409).json({ error: 'Insufficient funds' });
    }

    const amount = amountCents / 100;
    await db.updateBalances(fromAccountId, toAccountId, amount);

    const transferRecord = {
      id: crypto.randomUUID(),
      fromAccountId,
      toAccountId,
      amount,
      currency: fromAccount.currency || 'USD',
      status: 'completed',
      idempotencyKey,
      createdAt: new Date().toISOString()
    };

    await db.recordTransfer(transferRecord);

    const response = {
      message: 'Transfer successful',
      transfer: transferRecord
    };

    // Cache the result for idempotency (expire after 24h)
    processedTokens.set(idempotencyKey, response);
    setTimeout(() => processedTokens.delete(idempotencyKey), 24 * 60 * 60 * 1000).unref?.();

    return res.status(201).json(response);
  } catch (err) {
    // Avoid leaking internal details to the client
    console.error('Transfer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;