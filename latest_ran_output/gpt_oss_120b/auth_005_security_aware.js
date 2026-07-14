// accountLockout.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const router = express.Router();

// ---------- Mongoose User Schema ----------
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  // login lockout tracking
  failedLoginAttempts: { type: Number, default: 0 },   // consecutive failures
  lockCount: { type: Number, default: 0 },            // how many times locked
  lockUntil: Date                                    // null or future timestamp
});
const User = mongoose.model('User', userSchema);

// ---------- Config ----------
const MAX_ATTEMPTS = 5;                 // attempts before lockout
const BASE_LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const JWT_EXPIRES_IN = '1h';

// ---------- Helper: generic error response ----------
function authFailure(res) {
  // Uniform message, no hint about lockout vs bad credentials
  return res.status(401).json({ error: 'Invalid email or password.' });
}

// ---------- Login Route ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return authFailure(res);

  // Find user; if not found we still run bcrypt compare against a dummy hash
  const user = await User.findOne({ email }).exec();

  // Dummy hash for timing‑attack mitigation (bcrypt cost same as real hashes)
  const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8Q4K5G6cVh1eZz3Yp7xM/6aFvBfO5e'; // bcrypt hash of "password"

  // Helper to check lock status
  const isLocked = (usr) => usr.lockUntil && usr.lockUntil > Date.now();

  // If user exists, verify lockout before password check
  if (user) {
    if (isLocked(user)) {
      // Account currently locked – still perform dummy compare to keep timing consistent
      await bcrypt.compare(password, DUMMY_HASH);
      return authFailure(res);
    }
  }

  // Perform password comparison (real or dummy)
  const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordMatches) {
    // Wrong credentials – update lockout counters only if a real user exists
    if (user) {
      // Increment failure count
      user.failedLoginAttempts += 1;

      // If threshold reached, apply lockout with exponential back‑off
      if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
        user.lockCount = (user.lockCount || 0) + 1;
        const lockDurationMs = BASE_LOCK_TIME_MS * Math.pow(2, user.lockCount - 1);
        user.lockUntil = new Date(Date.now() + lockDurationMs);
        // Reset attempt counter after locking
        user.failedLoginAttempts = 0;
      }

      await user.save().catch(() => {}); // swallow save errors to avoid leaking info
    } else {
      // No user – still add artificial delay (bcrypt already did)
    }
    return authFailure(res);
  }

  // Successful login – reset lockout fields
  if (user) {
    user.failedLoginAttempts = 0;
    user.lockCount = 0;
    user.lockUntil = null;
    await user.save().catch(() => {});
  }

  // Issue JWT (or any session token)
  const payload = { sub: user._id, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.json({ token });
});

module.exports = router;