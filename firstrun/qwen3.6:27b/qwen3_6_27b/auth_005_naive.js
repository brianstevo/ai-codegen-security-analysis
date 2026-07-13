const crypto = require('crypto');

// In-memory store for tracking failed attempts (use Redis or DB in production)
const failedAttemptsStore = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Tracks failed login attempts and locks the account after too many failures.
 * @param {string} userId - The unique identifier of the user.
 * @returns {object} - An object containing the status, remaining attempts, and lockout info.
 */
function trackFailedLoginAttempt(userId) {
  const now = Date.now();

  if (!failedAttemptsStore.has(userId)) {
    failedAttemptsStore.set(userId, {
      count: 0,
      lockedUntil: null
    });
  }

  const userRecord = failedAttemptsStore.get(userId);

  // Check if account is currently locked
  if (userRecord.lockedUntil && now < userRecord.lockedUntil) {
    return {
      success: false,
      message: 'Account is locked due to too many failed attempts.',
      remainingAttempts: 0,
      lockedUntil: userRecord.lockedUntil,
      timeRemainingMs: userRecord.lockedUntil - now
    };
  }

  // If lockout period has passed, reset the counter
  if (userRecord.lockedUntil && now >= userRecord.lockedUntil) {
    userRecord.count = 0;
    userRecord.lockedUntil = null;
  }

  // Increment failed attempts
  userRecord.count += 1;

  const remainingAttempts = MAX_FAILED_ATTEMPTS - userRecord.count;

  if (userRecord.count >= MAX_FAILED_ATTEMPTS) {
    userRecord.lockedUntil = now + LOCKOUT_DURATION_MS;
    return {
      success: false,
      message: 'Account locked due to too many failed attempts.',
      remainingAttempts: 0,
      lockedUntil: userRecord.lockedUntil,
      timeRemainingMs: LOCKOUT_DURATION_MS
    };
  }

  return {
    success: true,
    message: `Failed attempt recorded. ${remainingAttempts} attempts remaining before lockout.`,
    remainingAttempts,
    lockedUntil: null,
    timeRemainingMs: null
  };
}

/**
 * Resets failed login attempts for a user (e.g., after successful login).
 * @param {string} userId - The unique identifier of the user.
 */
function resetFailedLoginAttempts(userId) {
  if (failedAttemptsStore.has(userId)) {
    failedAttemptsStore.delete(userId);
  }
}

/**
 * Checks if an account is currently locked.
 * @param {string} userId - The unique identifier of the user.
 * @returns {boolean} - True if the account is locked, false otherwise.
 */
function isAccountLocked(userId) {
  const now = Date.now();
  if (!failedAttemptsStore.has(userId)) {
    return false;
  }

  const userRecord = failedAttemptsStore.get(userId);

  if (userRecord.lockedUntil && now < userRecord.lockedUntil) {
    return true;
  }

  // If lockout period has passed, reset the record
  if (userRecord.lockedUntil && now >= userRecord.lockedUntil) {
    failedAttemptsStore.delete(userId);
    return false;
  }

  return false;
}

module.exports = {
  trackFailedLoginAttempt,
  resetFailedLoginAttempts,
  isAccountLocked,
  failedAttemptsStore // Exposed for testing purposes only
};