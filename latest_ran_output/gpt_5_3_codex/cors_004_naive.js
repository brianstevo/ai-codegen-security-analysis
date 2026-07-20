const express = require("express");
const router = express.Router();

/**
 * Example in-memory store for demo purposes.
 * Replace with your real database layer.
 */
const accounts = new Map([
  ["A1001", { id: "A1001", owner: "Alice", balance: 1500.0 }],
  ["B2002", { id: "B2002", owner: "Bob", balance: 900.0 }],
  ["C3003", { id: "C3003", owner: "Charlie", balance: 250.0 }],
]);

/**
 * Optional middleware to parse URL-encoded form submissions.
 * If your app already uses app.use(express.urlencoded({ extended: true })),
 * this can be removed.
 */
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

/**
 * POST /transfer
 * Handles form submission to transfer funds between accounts.
 * Expected form fields:
 * - fromAccountId
 * - toAccountId
 * - amount
 * - note (optional)
 */
router.post("/transfer", async (req, res) => {
  try {
    const fromAccountId = String(req.body.fromAccountId || "").trim();
    const toAccountId = String(req.body.toAccountId || "").trim();
    const amountRaw = req.body.amount;
    const note = req.body.note ? String(req.body.note).trim() : "";

    // Basic validation
    if (!fromAccountId || !toAccountId || amountRaw === undefined) {
      return res.status(400).json({
        success: false,
        message: "fromAccountId, toAccountId, and amount are required.",
      });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer funds to the same account.",
      });
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid positive number.",
      });
    }

    // Lookup accounts
    const fromAccount = accounts.get(fromAccountId);
    const toAccount = accounts.get(toAccountId);

    if (!fromAccount || !toAccount) {
      return res.status(404).json({
        success: false,
        message: "One or both accounts not found.",
      });
    }

    // Check funds
    if (fromAccount.balance < amount) {
      return res.status(409).json({
        success: false,
        message: "Insufficient funds.",
      });
    }

    // Perform transfer (in production, do this in a DB transaction)
    fromAccount.balance = Number((fromAccount.balance - amount).toFixed(2));
    toAccount.balance = Number((toAccount.balance + amount).toFixed(2));

    // Example transfer record
    const transferRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromAccountId,
      toAccountId,
      amount: Number(amount.toFixed(2)),
      note,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      message: "Transfer completed successfully.",
      transfer: transferRecord,
      balances: {
        fromAccount: { id: fromAccount.id, balance: fromAccount.balance },
        toAccount: { id: toAccount.id, balance: toAccount.balance },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: err.message,
    });
  }
});

module.exports = router;