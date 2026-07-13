// transferRoute.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');

const router = express.Router();

// ---------------------------------------------------
// DB setup (replace with your actual DB config)
const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite::memory:', {
    logging: false,
});

const Account = sequelize.define('Account', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false }, // owner of the account
    balance: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 0.00 },
}, {
    tableName: 'accounts',
    timestamps: false,
});
// ---------------------------------------------------

// Middleware to verify JWT and attach user info to req.user
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user; // { id: ..., email: ... } depending on your payload
        next();
    });
}

// Helper to parse and validate amount
function parseAmount(value) {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num) || num <= 0) return null;
    // round to two decimals
    return Math.round(num * 100) / 100;
}

// POST /transfer
router.post('/transfer', authenticateToken, async (req, res) => {
    const { fromAccountId, toAccountId, amount } = req.body;

    // Basic validation
    if (!fromAccountId || !toAccountId || typeof amount === 'undefined')
        return res.status(400).json({ error: 'Missing required fields' });

    const transferAmount = parseAmount(amount);
    if (transferAmount === null)
        return res.status(400).json({ error: 'Invalid amount. Must be a positive number.' });

    // Prevent self‑transfer (optional)
    if (Number(fromAccountId) === Number(toAccountId))
        return res.status(400).json({ error: 'Source and destination accounts must differ' });

    try {
        // Start transaction
        await sequelize.transaction(async (t) => {
            // Lock rows for update to avoid race conditions
            const fromAcc = await Account.findOne({
                where: { id: fromAccountId },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!fromAcc)
                throw { status: 404, message: 'Source account not found' };

            // Ensure the authenticated user owns the source account
            if (fromAcc.userId !== req.user.id)
                throw { status: 403, message: 'You do not own the source account' };

            const toAcc = await Account.findOne({
                where: { id: toAccountId },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!toAcc)
                throw { status: 404, message: 'Destination account not found' };

            // Check sufficient balance
            const currentBalance = parseFloat(fromAcc.balance);
            if (currentBalance < transferAmount)
                throw { status: 400, message: 'Insufficient funds in source account' };

            // Perform debit & credit
            fromAcc.balance = (currentBalance - transferAmount).toFixed(2);
            toAcc.balance = (parseFloat(toAcc.balance) + transferAmount).toFixed(2);

            await fromAcc.save({ transaction: t });
            await toAcc.save({ transaction: t });

            // Optionally, record the transaction in a separate table
        });

        // If we reach here, commit succeeded
        return res.status(200).json({
            message: 'Transfer completed successfully',
            transferredAmount: transferAmount,
            fromAccountId,
            toAccountId,
        });
    } catch (err) {
        if (err && err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error('Transfer error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;