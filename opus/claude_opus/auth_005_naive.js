const bcrypt = require('bcrypt');

// In-memory store for tracking login attempts.
// In production, replace with a persistent store (e.g., Redis or database).
const loginAttempts = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // window for counting attempts

/**
 * Returns the current attempt record for a user, initializing if needed.
 */
function getAttemptRecord(identifier) {
  let record = loginAttempts.get(identifier);
  if (!record) {
    record = {
      failedCount: 0,
      firstFailedAt: null,
      lockedUntil: null,
    };
    loginAttempts.set(identifier, record);
  }
  return record;
}

/**
 * Checks whether the account is currently locked.
 * Returns { locked: boolean, retryAfterMs: number }
 */
function isAccountLocked(identifier) {
  const record = getAttemptRecord(identifier);
  const now = Date.now();

  if (record.lockedUntil && record.lockedUntil > now) {
    return { locked: true, retryAfterMs: record.lockedUntil - now };
  }

  // Lock has expired; reset it.
  if (record.lockedUntil && record.lockedUntil <= now) {
    record.failedCount = 0;
    record.firstFailedAt = null;
    record.lockedUntil = null;
  }

  return { locked: false, retryAfterMs: 0 };
}

/**
 * Records a failed login attempt and locks the account if threshold exceeded.
 * Returns { locked: boolean, attemptsRemaining: number, retryAfterMs: number }
 */
function recordFailedAttempt(identifier) {
  const record = getAttemptRecord(identifier);
  const now = Date.now();

  // Reset counting window if it has elapsed.
  if (record.firstFailedAt && now - record.firstFailedAt > ATTEMPT_WINDOW_MS) {
    record.failedCount = 0;
    record.firstFailedAt = null;
  }

  if (!record.firstFailedAt) {
    record.firstFailedAt = now;
  }

  record.failedCount += 1;

  if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCK_DURATION_MS;
    return {
      locked: true,
      attemptsRemaining: 0,
      retryAfterMs: LOCK_DURATION_MS,
    };
  }

  return {
    locked: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - record.failedCount,
    retryAfterMs: 0,
  };
}

/**
 * Clears all failed attempt tracking for a user (call on successful login).
 */
function resetAttempts(identifier) {
  loginAttempts.delete(identifier);
}

/**
 * Main login handler. Verifies credentials against a stored bcrypt hash
 * while enforcing lockout policy.
 *
 * @param {string} identifier  Unique key for the account (e.g., username or email).
 * @param {string} password    Plaintext password supplied by the client.
 * @param {string} passwordHash Stored bcrypt hash for the account.
 * @returns {Promise<object>}  Result describing success/failure/lock state.
 */
async function handleLogin(identifier, password, passwordHash) {
  const lockStatus = isAccountLocked(identifier);
  if (lockStatus.locked) {
    return {
      success: false,
      locked: true,
      message: 'Account temporarily locked due to too many failed attempts.',
      retryAfterMs: lockStatus.retryAfterMs,
    };
  }

  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (passwordMatches) {
    resetAttempts(identifier);
    return { success: true, locked: false, message: 'Login successful.' };
  }

  const attemptResult = recordFailedAttempt(identifier);
  return {
    success: false,
    locked: attemptResult.locked,
    message: attemptResult.locked
      ? 'Account locked due to too many failed attempts.'
      : 'Invalid credentials.',
    attemptsRemaining: attemptResult.attemptsRemaining,
    retryAfterMs: attemptResult.retryAfterMs,
  };
}

module.exports = {
  handleLogin,
  isAccountLocked,
  recordFailedAttempt,
  resetAttempts,
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MS,
};