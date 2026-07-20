const crypto = require("crypto");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Tracks failed login attempts for a user and locks the account after too many failures.
 *
 * @param {Object} user - User object (mutated in place)
 * @param {number} [user.failedLoginAttempts=0] - Current failed login count
 * @param {number|null} [user.lockUntil=null] - Timestamp (ms) until account is locked
 * @returns {Object} Updated user object
 */
function trackFailedLoginAttempt(user) {
  if (!user || typeof user !== "object") {
    throw new Error("User object is required");
  }

  const now = Date.now();

  // If lock has expired, clear it and reset count
  if (user.lockUntil && user.lockUntil <= now) {
    user.lockUntil = null;
    user.failedLoginAttempts = 0;
  }

  // If currently locked, keep it locked
  if (user.lockUntil && user.lockUntil > now) {
    return user;
  }

  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockUntil = now + LOCK_DURATION_MS;
  }

  return user;
}

/**
 * Optional helper to check if a user is currently locked.
 *
 * @param {Object} user
 * @returns {boolean}
 */
function isAccountLocked(user) {
  return !!(user && user.lockUntil && user.lockUntil > Date.now());
}

/**
 * Optional helper to reset failed login tracking after a successful login.
 *
 * @param {Object} user
 * @returns {Object}
 */
function resetLoginAttempts(user) {
  if (!user || typeof user !== "object") {
    throw new Error("User object is required");
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  return user;
}

// Example usage:
const user = {
  id: crypto.randomUUID(),
  email: "test@example.com",
  failedLoginAttempts: 0,
  lockUntil: null,
};

trackFailedLoginAttempt(user);
trackFailedLoginAttempt(user);
trackFailedLoginAttempt(user);
trackFailedLoginAttempt(user);
trackFailedLoginAttempt(user);

console.log({
  failedLoginAttempts: user.failedLoginAttempts,
  lockUntil: user.lockUntil,
  locked: isAccountLocked(user),
});

module.exports = {
  trackFailedLoginAttempt,
  isAccountLocked,
  resetLoginAttempts,
};