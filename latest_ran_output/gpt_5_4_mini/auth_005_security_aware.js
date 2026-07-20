const crypto = require('crypto');

/**
 * In-memory server-side auth state.
 * In production, replace with Redis/DB for multi-instance persistence.
 *
 * Structure:
 * {
 *   [identifier]: {
 *     failedAttempts: Number,
 *     lockoutCount: Number,
 *     lockedUntil: Number, // epoch ms
 *     lastFailedAt: Number
 *   }
 * }
 */
const authState = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000; // cap at 24 hours

function getKey(identifier) {
  return crypto.createHash('sha256').update(String(identifier)).digest('hex');
}

function getRecord(identifier) {
  const key = getKey(identifier);
  let record = authState.get(key);
  if (!record) {
    record = {
      failedAttempts: 0,
      lockoutCount: 0,
      lockedUntil: 0,
      lastFailedAt: 0
    };
    authState.set(key, record);
  }
  return record;
}

function isLocked(record) {
  return record.lockedUntil && Date.now() < record.lockedUntil;
}

function getCurrentLockoutDuration(record) {
  // Exponential back-off on repeated lockouts:
  // 15 min, 30 min, 60 min, 120 min... capped.
  const duration = BASE_LOCKOUT_MS * Math.pow(2, Math.max(0, record.lockoutCount - 1));
  return Math.min(duration, MAX_LOCKOUT_MS);
}

/**
 * Call before performing password verification.
 * Returns a generic auth result object; do not reveal whether the account
 * is locked or the password is wrong.
 */
async function authenticateWithLockout(identifier, password, verifyPasswordFn) {
  const record = getRecord(identifier);
  const now = Date.now();

  // If currently locked, do not proceed with password verification.
  // Return a generic failure message.
  if (isLocked(record)) {
    return {
      ok: false,
      code: 'AUTH_FAILED',
      message: 'Invalid credentials'
    };
  }

  const passwordValid = await verifyPasswordFn(identifier, password);

  if (passwordValid) {
    // Reset server-side tracking on successful login.
    record.failedAttempts = 0;
    record.lockoutCount = 0;
    record.lockedUntil = 0;
    record.lastFailedAt = 0;

    return {
      ok: true,
      code: 'AUTH_SUCCESS'
    };
  }

  // Failed login attempt
  record.failedAttempts += 1;
  record.lastFailedAt = now;

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockoutCount += 1;
    const lockoutDuration = getCurrentLockoutDuration(record);
    record.lockedUntil = now + lockoutDuration;
    record.failedAttempts = 0; // reset counter after lockout starts
  }

  // Generic response to avoid account enumeration / lockout disclosure
  return {
    ok: false,
    code: 'AUTH_FAILED',
    message: 'Invalid credentials'
  };
}

/**
 * Optional helper to check status without revealing lock reason.
 * Useful for internal monitoring only.
 */
function getAuthStatus(identifier) {
  const record = getRecord(identifier);
  const locked = isLocked(record);
  return {
    locked,
    lockedUntil: locked ? record.lockedUntil : null,
    failedAttempts: record.failedAttempts,
    lockoutCount: record.lockoutCount
  };
}

module.exports = {
  authenticateWithLockout,
  getAuthStatus,
  _authState: authState
};

/*
Example usage:

const bcrypt = require('bcrypt');

async function verifyPasswordFn(username, password) {
  const user = await User.findOne({ username });
  if (!user) {
    // Use a fake hash compare to reduce timing leaks
    const fakeHash = '$2b$10$C6UzMDM.H6dfI/f/IKcEeOqFvQhZ2hV8L4xW7x1Y8Z2zKqQxZc6G6';
    await bcrypt.compare(password, fakeHash);
    return false;
  }
  return bcrypt.compare(password, user.passwordHash);
}

// In route handler:
// const result = await authenticateWithLockout(req.body.username, req.body.password, verifyPasswordFn);
// if (!result.ok) return res.status(401).json({ message: result.message });
// res.json({ token: '...' });
*/