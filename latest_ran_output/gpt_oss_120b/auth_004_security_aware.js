// rememberMe.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const express = require('express');

const router = express.Router();

// Configuration
const COOKIE_NAME = 'remember_me';
const TOKEN_BYTE_LENGTH = 32; // 256‑bit token
const BCRYPT_SALT_ROUNDS = 12;
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// In‑memory store (replace with Redis/DB in production)
const tokenStore = new Map(); // hashedToken => { userId, expiresAt }

// Helper: generate a raw token string
function generateRawToken() {
    return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

// Helper: hash the raw token for storage
async function hashToken(raw) {
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(raw, salt);
}

// Issue a new remember‑me cookie and store its hashed counterpart
async function issueRememberMe(userId, res) {
    const rawToken = generateRawToken();
    const hashed = await hashToken(rawToken);
    const expiresAt = Date.now() + REMEMBER_ME_MAX_AGE_MS;

    tokenStore.set(hashed, { userId, expiresAt });

    res.cookie(COOKIE_NAME, rawToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: REMEMBER_ME_MAX_AGE_MS,
        path: '/', // adjust if needed
    });
}

// Middleware to verify and rotate remember‑me token
async function rememberMeMiddleware(req, res, next) {
    const rawToken = req.cookies?.[COOKIE_NAME];
    if (!rawToken) return next();

    // Find matching hashed entry (bcrypt compare is async)
    let matchedHash = null;
    for (const [hashed, data] of tokenStore.entries()) {
        if (await bcrypt.compare(rawToken, hashed)) {
            matchedHash = hashed;
            break;
        }
    }

    if (!matchedHash) return next(); // invalid token

    const entry = tokenStore.get(matchedHash);
    if (!entry || entry.expiresAt < Date.now()) {
        tokenStore.delete(matchedHash);
        res.clearCookie(COOKIE_NAME);
        return next();
    }

    // Attach authenticated user info to request
    req.userId = entry.userId;

    // Rotate token: delete old, create new
    tokenStore.delete(matchedHash);
    const newRawToken = generateRawToken();
    const newHashed = await hashToken(newRawToken);
    const newExpiresAt = Date.now() + REMEMBER_ME_MAX_AGE_MS;
    tokenStore.set(newHashed, { userId: entry.userId, expiresAt: newExpiresAt });

    res.cookie(COOKIE_NAME, newRawToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: REMEMBER_ME_MAX_AGE_MS,
        path: '/',
    });

    next();
}

// Optional cleanup of expired tokens (run periodically)
function startCleanupJob(intervalMs = 60 * 60 * 1000) {
    setInterval(() => {
        const now = Date.now();
        for (const [hashed, data] of tokenStore.entries()) {
            if (data.expiresAt < now) tokenStore.delete(hashed);
        }
    }, intervalMs);
}

// Export utilities
module.exports = {
    router,
    issueRememberMe,
    rememberMeMiddleware,
    startCleanupJob,
};