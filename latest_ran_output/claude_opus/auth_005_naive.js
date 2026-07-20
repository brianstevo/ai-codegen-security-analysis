const LOCK_CONFIG = {
  maxAttempts: 5,
  lockDurationMs: 15 * 60 * 1000, // 15 minutes
  attemptWindowMs: 15 * 60 * 1000 // reset counter after this window of inactivity
};

// In-memory store. Replace with Redis/DB in production.
const loginAttemptStore = new Map();

/**
 * Retrieve (or initialize) the attempt record for an identifier (e.g. username/email/IP).
 */
function getAttemptRecord(identifier) {
  let record = loginAttemptStore.get(identifier);
  if (!record) {
    record = {
      failedAttempts: 0,
      firstAttemptAt: null,
      lastAttemptAt: null,
      lockedUntil: null
    };
    loginAttemptStore.set(identifier, record);
  }
  return record;
}

/**
 * Check whether an account is currently locked.
 * Returns { locked: boolean, remainingMs: number, attemptsRemaining: number }
 */
function checkLockStatus(identifier) {
  const record = getAttemptRecord(identifier);
  const now = Date.now();

  // Clear expired lock
  if (record.lockedUntil && now >= record.lockedUntil) {
    resetAttempts(identifier);
    return {
      locked: false,
      remainingMs: 0,
      attemptsRemaining: LOCK_CONFIG.maxAttempts
    };
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      locked: true,
      remainingMs: record.lockedUntil - now,
      attemptsRemaining: 0
    };
  }

  return {
    locked: false,
    remainingMs: 0,
    attemptsRemaining: Math.max(0, LOCK_CONFIG.maxAttempts - record.failedAttempts)
  };
}

/**
 * Record a failed login attempt. Locks the account if the threshold is reached.
 * Returns the updated lock status.
 */
function recordFailedAttempt(identifier) {
  const record = getAttemptRecord(identifier);
  const now = Date.now();

  // Reset counter if the attempt window has elapsed since the first attempt.
  if (record.firstAttemptAt && now - record.firstAttemptAt > LOCK_CONFIG.attemptWindowMs) {
    record.failedAttempts = 0;
    record.firstAttemptAt = null;
  }

  if (!record.firstAttemptAt) {
    record.firstAttemptAt = now;
  }

  record.failedAttempts += 1;
  record.lastAttemptAt = now;

  if (record.failedAttempts >= LOCK_CONFIG.maxAttempts) {
    record.lockedUntil = now + LOCK_CONFIG.lockDurationMs;
  }

  return checkLockStatus(identifier);
}

/**
 * Record a successful login. Clears all failure/lock state.
 */
function recordSuccessfulLogin(identifier) {
  resetAttempts(identifier);
}

/**
 * Reset all attempt tracking for an identifier.
 */
function resetAttempts(identifier) {
  loginAttemptStore.delete(identifier);
}

/**
 * Express middleware to block requests to locked accounts before auth is attempted.
 * Expects req.body.username (adjust to your route's field).
 */
function loginRateLimiter(req, res, next) {
  const identifier = (req.body && req.body.username) || req.ip;
  const status = checkLockStatus(identifier);

  if (status.locked) {
    const retryAfterSec = Math.ceil(status.remainingMs / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: 'Account temporarily locked due to too many failed login attempts.',
      retryAfterSeconds: retryAfterSec
    });
  }

  req.loginIdentifier = identifier;
  next();
}

module.exports = {
  LOCK_CONFIG,
  checkLockStatus,
  recordFailedAttempt,
  recordSuccessfulLogin,
  resetAttempts,
  loginRateLimiter
};