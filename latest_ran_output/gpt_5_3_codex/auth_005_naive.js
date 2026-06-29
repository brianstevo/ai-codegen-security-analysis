/**
 * Tracks failed login attempts and locks account after too many failures.
 * 
 * Usage:
 *   const user = {
 *     id: 'u1',
 *     failedLoginAttempts: 0,
 *     lockUntil: null
 *   };
 * 
 *   const result = recordFailedLoginAttempt(user, {
 *     maxAttempts: 5,
 *     lockDurationMs: 15 * 60 * 1000 // 15 minutes
 *   });
 * 
 *   // result = {
 *   //   failedLoginAttempts: number,
 *   //   isLocked: boolean,
 *   //   lockUntil: Date|null,
 *   //   attemptsRemaining: number
 *   // }
 */

/**
 * Returns whether the account is currently locked.
 * @param {Object} user
 * @returns {boolean}
 */
function isAccountLocked(user) {
  return !!(user.lockUntil && new Date(user.lockUntil).getTime() > Date.now());
}

/**
 * Resets lock/attempt counters if lock has expired.
 * @param {Object} user
 */
function clearExpiredLock(user) {
  if (user.lockUntil && new Date(user.lockUntil).getTime() <= Date.now()) {
    user.lockUntil = null;
    user.failedLoginAttempts = 0;
  }
}

/**
 * Record a failed login attempt and lock the account if threshold is reached.
 * @param {Object} user - mutable user object (e.g., DB row/document)
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=5] - number of failures before locking
 * @param {number} [options.lockDurationMs=900000] - lock duration in ms (default 15 min)
 * @returns {{
 *   failedLoginAttempts: number,
 *   isLocked: boolean,
 *   lockUntil: Date|null,
 *   attemptsRemaining: number
 * }}
 */
function recordFailedLoginAttempt(user, options = {}) {
  const maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : 5;
  const lockDurationMs = Number.isInteger(options.lockDurationMs)
    ? options.lockDurationMs
    : 15 * 60 * 1000;

  if (!user || typeof user !== 'object') {
    throw new Error('User object is required');
  }

  if (!Number.isInteger(user.failedLoginAttempts) || user.failedLoginAttempts < 0) {
    user.failedLoginAttempts = 0;
  }

  clearExpiredLock(user);

  // If still locked, don't increase attempts; keep lock state.
  if (isAccountLocked(user)) {
    return {
      failedLoginAttempts: user.failedLoginAttempts,
      isLocked: true,
      lockUntil: new Date(user.lockUntil),
      attemptsRemaining: 0
    };
  }

  user.failedLoginAttempts += 1;

  if (user.failedLoginAttempts >= maxAttempts) {
    user.lockUntil = new Date(Date.now() + lockDurationMs);
  }

  const locked = isAccountLocked(user);
  const attemptsRemaining = locked
    ? 0
    : Math.max(0, maxAttempts - user.failedLoginAttempts);

  return {
    failedLoginAttempts: user.failedLoginAttempts,
    isLocked: locked,
    lockUntil: locked ? new Date(user.lockUntil) : null,
    attemptsRemaining
  };
}

/**
 * Call on successful login to clear counters/locks.
 * @param {Object} user
 * @returns {{ failedLoginAttempts: number, isLocked: boolean, lockUntil: null }}
 */
function resetLoginAttempts(user) {
  if (!user || typeof user !== 'object') {
    throw new Error('User object is required');
  }
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  return {
    failedLoginAttempts: 0,
    isLocked: false,
    lockUntil: null
  };
}

module.exports = {
  recordFailedLoginAttempt,
  resetLoginAttempts,
  isAccountLocked,
  clearExpiredLock
};