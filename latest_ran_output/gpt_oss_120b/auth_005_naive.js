// loginLock.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ----- Configuration -----
const MAX_FAILED_ATTEMPTS = 5;               // attempts before lock
const LOCK_TIME_MS = 30 * 60 * 1000;         // lock duration (30 min)
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// ----- In‑memory store (replace with Redis/DB in prod) -----
/*
   Structure:
   {
     count: Number,          // current failed attempts
     lockUntil: Number|null  // timestamp when lock expires
   }
*/
const loginAttempts = new Map();

// ----- Helper functions -----
function isAccountLocked(userId) {
  const rec = loginAttempts.get(userId);
  if (!rec) return false;

  if (rec.lockUntil && Date.now() < rec.lockUntil) {
    return true; // still locked
  }

  // lock expired – clean up
  if (rec.lockUntil && Date.now() >= rec.lockUntil) {
    loginAttempts.delete(userId);
  }
  return false;
}

function recordFailedLogin(userId) {
  const now = Date.now();
  let rec = loginAttempts.get(userId);

  if (!rec) {
    rec = { count: 1, lockUntil: null };
  } else {
    // If previously locked and the lock has expired, start fresh
    if (rec.lockUntil && now >= rec.lockUntil) {
      rec = { count: 1, lockUntil: null };
    } else {
      rec.count += 1;
    }
  }

  if (rec.count >= MAX_FAILED_ATTEMPTS) {
    rec.lockUntil = now + LOCK_TIME_MS;
    rec.count = 0; // reset counter after locking
  }

  loginAttempts.set(userId, rec);
}

function resetFailedLogins(userId) {
  loginAttempts.delete(userId);
}

// ----- Example Express integration -----
const app = express();
app.use(express.json());

// Mock DB call – replace with real implementation
async function getUserByEmail(email) {
  // return { id: 'user-id', hashedPassword: '$2b$10$...' } or null
  return null;
}

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  if (isAccountLocked(user.id)) {
    return res
      .status(403)
      .json({ error: `Account locked. Try again later.` });
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.hashedPassword
  );

  if (!passwordMatches) {
    recordFailedLogin(user.id);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Successful login – clear any failure records
  resetFailedLogins(user.id);

  const token = jwt.sign(
    { sub: user.id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

// Export utilities for reuse/testing
module.exports = {
  isAccountLocked,
  recordFailedLogin,
  resetFailedLogins,
  app, // optional – expose the Express app
};