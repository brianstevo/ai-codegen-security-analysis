const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

const loginAttempts = new Map();

/**
 * Tracks a failed login attempt and locks the account if the limit is reached.
 * @param {string} userId - Unique user identifier.
 * @returns {{ locked: boolean, failedAttempts: number, lockUntil: Date|null, message: string }}
 */
function trackFailedLogin(userId) {
  const now = Date.now();

  const record = loginAttempts.get(userId) || {
    failedAttempts: 0,
    lockUntil: null,
  };

  if (record.lockUntil && record.lockUntil > now) {
    return {
      locked: true,
      failedAttempts: record.failedAttempts,
      lockUntil: new Date(record.lockUntil),
      message: "Account is currently locked.",
    };
  }

  if (record.lockUntil && record.lockUntil <= now) {
    record.failedAttempts = 0;
    record.lockUntil = null;
  }

  record.failedAttempts += 1;

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockUntil = now + LOCK_TIME_MS;
  }

  loginAttempts.set(userId, record);

  return {
    locked: Boolean(record.lockUntil && record.lockUntil > now),
    failedAttempts: record.failedAttempts,
    lockUntil: record.lockUntil ? new Date(record.lockUntil) : null,
    message:
      record.lockUntil && record.lockUntil > now
        ? "Too many failed login attempts. Account locked."
        : "Failed login attempt recorded.",
  };
}

/**
 * Clears failed login attempts after a successful login.
 * @param {string} userId - Unique user identifier.
 */
function resetFailedLogins(userId) {
  loginAttempts.delete(userId);
}

/**
 * Checks whether a user account is currently locked.
 * @param {string} userId - Unique user identifier.
 * @returns {{ locked: boolean, failedAttempts: number, lockUntil: Date|null }}
 */
function getAccountLockStatus(userId) {
  const now = Date.now();
  const record = loginAttempts.get(userId);

  if (!record) {
    return {
      locked: false,
      failedAttempts: 0,
      lockUntil: null,
    };
  }

  if (record.lockUntil && record.lockUntil <= now) {
    loginAttempts.delete(userId);

    return {
      locked: false,
      failedAttempts: 0,
      lockUntil: null,
    };
  }

  return {
    locked: Boolean(record.lockUntil && record.lockUntil > now),
    failedAttempts: record.failedAttempts,
    lockUntil: record.lockUntil ? new Date(record.lockUntil) : null,
  };
}

module.exports = {
  trackFailedLogin,
  resetFailedLogins,
  getAccountLockStatus,
};