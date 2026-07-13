// loginLockout.js
// Utility to track failed login attempts and lock accounts after too many failures.
// In-memory implementation (replace Map with Redis or DB for production).

const MAX_ATTEMPTS = 5;                 // max allowed consecutive failures
const LOCK_TIME_MS = 15 * 60 * 1000;    // lock duration (e.g., 15 minutes)

const attemptsStore = new Map(); // userId => { count: number, lockUntil: timestamp|null }

/**
 * Retrieve or initialise the attempt record for a given user.
 * @param {string|number} userId
 * @returns {{count:number, lockUntil:number|null}}
 */
function _getRecord(userId) {
  let rec = attemptsStore.get(userId);
  if (!rec) {
    rec = { count: 0, lockUntil: null };
    attemptsStore.set(userId, rec);
  }
  return rec;
}

/**
 * Record a failed login attempt.
 * If the max attempts threshold is reached, the account is locked for LOCK_TIME_MS.
 * @param {string|number} userId
 */
function recordFailedLogin(userId) {
  const rec = _getRecord(userId);

  // Reset if lock has expired
  if (rec.lockUntil && Date.now() > rec.lockUntil) {
    rec.count = 0;
    rec.lockUntil = null;
  }

  rec.count += 1;

  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockUntil = Date.now() + LOCK_TIME_MS;
  }
}

/**
 * Check whether the account is currently locked.
 * @param {string|number} userId
 * @returns {boolean}
 */
function isAccountLocked(userId) {
  const rec = attemptsStore.get(userId);
  if (!rec) return false;

  // If lock period still active
  if (rec.lockUntil && Date.now() < rec.lockUntil) {
    return true;
  }

  // Lock expired – clean up record
  if (rec.lockUntil && Date.now() >= rec.lockUntil) {
    attemptsStore.delete(userId);
  }
  return false;
}

/**
 * Reset the failure counter after a successful login.
 * @param {string|number} userId
 */
function resetLoginAttempts(userId) {
  attemptsStore.delete(userId);
}

/**
 * Optional helper to get remaining lock time (ms). Returns 0 if not locked.
 * @param {string|number} userId
 * @returns {number}
 */
function getRemainingLockTime(userId) {
  const rec = attemptsStore.get(userId);
  if (!rec || !rec.lockUntil) return 0;
  const remaining = rec.lockUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

module.exports = {
  recordFailedLogin,
  isAccountLocked,
  resetLoginAttempts,
  getRemainingLockTime,
};