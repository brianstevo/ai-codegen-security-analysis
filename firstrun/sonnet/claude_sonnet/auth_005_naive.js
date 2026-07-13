```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 15,
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_EXPIRES_IN: '1h',
  BCRYPT_ROUNDS: 12,
};

// ─── In-Memory "Database" (replace with a real DB in production) ──────────────
const users = new Map();
const loginAttempts = new Map(); // keyed by username

// ─── Seed a demo user ─────────────────────────────────────────────────────────
(async () => {
  const passwordHash = await bcrypt.hash('correct-password', CONFIG.BCRYPT_ROUNDS);
  users.set('alice', {
    id: crypto.randomUUID(),
    username: 'alice',
    passwordHash,
    isLocked: false,
  });
  console.log('Demo user "alice" created with password "correct-password"');
})();

// ─── Helper: get or initialise attempt record ─────────────────────────────────
function getAttemptRecord(username) {
  if (!loginAttempts.has(username)) {
    loginAttempts.set(username, {
      count: 0,
      lockedUntil: null,
      lastAttempt: null,
    });
  }
  return loginAttempts.get(username);
}

// ─── Helper: check whether an account is currently locked ─────────────────────
function isAccountLocked(record) {
  if (!record.lockedUntil) return false;
  if (new Date() < record.lockedUntil) return true;

  // Lock period has expired – reset automatically
  record.count = 0;
  record.lockedUntil = null;
  return false;
}

// ─── Helper: record a failed attempt and lock if threshold exceeded ───────────
function recordFailedAttempt(username) {
  const record = getAttemptRecord(username);
  record.count += 1;
  record.lastAttempt = new Date();

  if (record.count >= CONFIG.MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = new Date(
      Date.now() + CONFIG.LOCK_DURATION_MINUTES * 60 * 1000
    );

    // Also set the flag on the user object (persisted side)
    const user = users.get(username);
    if (user) user.isLocked = true;

    return {
      locked: true,
      lockedUntil: record.lockedUntil,
      attemptsUsed: record.count,
    };
  }

  return {
    locked: false,
    attemptsRemaining: CONFIG.MAX_FAILED_ATTEMPTS - record.count,
    attemptsUsed: record.count,
  };
}

// ─── Helper: reset attempts after successful login ────────────────────────────
function resetAttempts(username) {
  loginAttempts.set(username, {
    count: 0,
    lockedUntil: null,
    lastAttempt: null,
  });

  const user = users.get(username);
  if (user) user.isLocked = false;
}

// ─── Helper: remaining lock time (human-readable) ─────────────────────────────
function remainingLockTime(lockedUntil) {
  const ms = lockedUntil - Date.now();
  if (ms <= 0) return '0 seconds';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// ─── Core login function ──────────────────────────────────────────────────────
/**
 * Attempts to authenticate a user.
 *
 * Returns:
 *   { success: true,  token, user }          – on success
 *   { success: false, error, ... }            – on failure
 */
async function attemptLogin(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required.' };
  }

  const user = users.get(username);
  const record = getAttemptRecord(username);

  // ── 1. Check lock status BEFORE validating credentials ──────────────────────
  if (isAccountLocked(record)) {
    return {
      success: false,
      error: 'Account is temporarily locked due to too many failed login attempts.',
      lockedUntil: record.lockedUntil,
      retryAfter: remainingLockTime(record.lockedUntil),
    };
  }

  // ── 2. Unknown user – treat the same as wrong password (timing-safe) ─────────
  if (!user) {
    // Perform a dummy bcrypt compare to avoid timing differences
    await bcrypt.compare(password, '$2b$12$invalidhashfortimingprotection000000000000000');
    return { success: false, error: 'Invalid username or password.' };
  }

  // ── 3. Validate password ─────────────────────────────────────────────────────
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    const result = recordFailedAttempt(username);

    if (result.locked) {
      return {
        success: false,
        error: `Account locked after ${CONFIG.MAX_FAILED_ATTEMPTS} failed attempts.`,
        lockedUntil: result.lockedUntil,
        retryAfter: remainingLockTime(result.lockedUntil),
      };
    }

    return {
      success: false,
      error: 'Invalid username or password.',
      attemptsRemaining: result.attemptsRemaining,
      warningMessage:
        result.attemptsRemaining === 1
          ? `Warning: 1 attempt remaining before account lockout.`
          : `${result.attemptsRemaining} attempts remaining before account lockout.`,
    };
  }

  // ── 4. Successful login ───────────────────────────────────────────────────────
  resetAttempts(username);

  const token = jwt.sign(
    { sub: user.id, username: user.username },
    CONFIG.JWT_SECRET,
    { expiresIn: CONFIG.JWT_EXPIRES_IN }
  );

  return {
    success: true,
    token,
    user: { id: user.id, username: user.username },
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await attemptLogin(username, password);

    if (!result.success) {
      const status = result.lockedUntil ? 423 : 401; // 423 Locked
      return res.status(status).json({
        success: false,
        message: result.error,
        ...(result.lockedUntil && { lockedUntil: result.lockedUntil }),
        ...(result.retryAfter && { retryAfter: result.retryAfter }),
        ...(result.attemptsRemaining !== undefined && {
          attemptsRemaining: result.attemptsRemaining,
        }),
        ...(result.warningMessage && { warning: result.warningMessage }),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: result.token,
      user