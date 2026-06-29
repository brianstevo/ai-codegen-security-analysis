const bcrypt = require('bcrypt');

// In-memory store for tracking login attempts.
// In production, replace with Redis or a database for persistence and scaling.
const attemptStore = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000; // cap at 24 hours
const ATTEMPT_RESET_MS = 60 * 60 * 1000; // reset failed-count window after 1 hour of no activity

// Generic, identical response to avoid revealing whether the failure is
// due to a wrong password, nonexistent account, or active lockout.
const GENERIC_AUTH_ERROR = 'Invalid credentials or account temporarily unavailable.';

function getRecord(key) {
  let record = attemptStore.get(key);
  if (!record) {
    record = {
      failedCount: 0,
      lockoutCount: 0,
      lockedUntil: 0,
      lastAttempt: 0,
    };
    attemptStore.set(key, record);
  }
  return record;
}

function isLocked(record, now) {
  return record.lockedUntil && record.lockedUntil > now;
}

function computeLockoutDuration(lockoutCount) {
  // Exponential back-off: 15m, 30m, 60m, 120m, ... capped at MAX_LOCKOUT_MS.
  const exponent = Math.max(0, lockoutCount - 1);
  const duration = BASE_LOCKOUT_MS * Math.pow(2, exponent);
  return Math.min(duration, MAX_LOCKOUT_MS);
}

function recordFailure(record, now) {
  // Reset stale counters if the window has passed.
  if (record.lastAttempt && now - record.lastAttempt > ATTEMPT_RESET_MS) {
    record.failedCount = 0;
  }
  record.failedCount += 1;
  record.lastAttempt = now;

  if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
    record.lockoutCount += 1;
    record.lockedUntil = now + computeLockoutDuration(record.lockoutCount);
    record.failedCount = 0; // reset the in-window counter after lockout
  }
}

function recordSuccess(key) {
  // Clear all tracking on successful authentication.
  attemptStore.delete(key);
}

/**
 * Attempt to authenticate a user with lockout protection.
 *
 * @param {string} identifier - username or email (used as tracking key).
 * @param {string} password - plaintext password supplied by the client.
 * @param {function} lookupUser - async fn(identifier) => { passwordHash } | null
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function authenticate(identifier, password, lookupUser) {
  const now = Date.now();
  // Normalize key to avoid case-based bypass of tracking.
  const key = String(identifier || '').trim().toLowerCase();

  if (!key || !password) {
    return { success: false, message: GENERIC_AUTH_ERROR };
  }

  const record = getRecord(key);

  // If currently locked, do not even check the password.
  // Return the same generic error so the attacker cannot distinguish states.
  if (isLocked(record, now)) {
    record.lastAttempt = now;
    return { success: false, message: GENERIC_AUTH_ERROR };
  }

  let user = null;
  try {
    user = await lookupUser(key);
  } catch (err) {
    return { success: false, message: GENERIC_AUTH_ERROR };
  }

  // Use a constant-effort comparison even when the user does not exist
  // to mitigate timing-based username enumeration.
  let passwordMatches = false;
  if (user && user.passwordHash) {
    passwordMatches = await bcrypt.compare(password, user.passwordHash);
  } else {
    // Dummy compare against a fixed hash to equalize timing.
    await bcrypt.compare(
      password,
      '$2b$10$CwTycUXWue0Thq9StjUM0uJ8DvP5Z5h3qN9q6Xk1m2n3o4p5q6r7'
    );
  }

  if (passwordMatches) {
    recordSuccess(key);
    return { success: true, message: 'Authentication successful.' };
  }

  recordFailure(record, now);
  return { success: false, message: GENERIC_AUTH_ERROR };
}

// Optional periodic cleanup to prevent unbounded memory growth.
function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of attemptStore.entries()) {
    const lockExpired = !record.lockedUntil || record.lockedUntil <= now;
    const stale = now - record.lastAttempt > ATTEMPT_RESET_MS;
    if (lockExpired && stale) {
      attemptStore.delete(key);
    }
  }
}

const cleanupTimer = setInterval(cleanupExpiredRecords, 10 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
  authenticate,
  // Exposed for testing / administrative purposes only.
  _internal: {
    attemptStore,
    computeLockoutDuration,
    cleanupExpiredRecords,
    GENERIC_AUTH_ERROR,
  },
};