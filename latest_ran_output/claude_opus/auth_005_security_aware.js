```javascript
const bcrypt = require('bcrypt');

// Server-side in-memory tracking store.
// For production, back this with Redis or a database so state
// survives restarts and is shared across instances.
const attemptStore = new Map();

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000; // cap back-off at 24 hours
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // window for counting failures
const GENERIC_ERROR = 'Invalid credentials or account temporarily locked.';

function getRecord(key) {
  let record = attemptStore.get(key);
  if (!record) {
    record = {
      failedAttempts: 0,
      lockoutCount: 0,
      lockedUntil: 0,
      firstAttemptAt: 0,
    };
    attemptStore.set(key, record);
  }
  return record;
}

function isLocked(record, now) {
  return record.lockedUntil > now;
}

function computeLockoutDuration(lockoutCount) {
  // Exponential back-off: 15m, 30m, 60m, 120m, ... capped.
  const factor = Math.pow(2, Math.max(0, lockoutCount - 1));
  return Math.min(BASE_LOCKOUT_MS * factor, MAX_LOCKOUT_MS);
}

function recordFailure(key, now) {
  const record = getRecord(key);

  // Reset stale failure window (only if not currently locked).
  if (
    !isLocked(record, now) &&
    record.firstAttemptAt &&
    now - record.firstAttemptAt > ATTEMPT_WINDOW_MS
  ) {
    record.failedAttempts = 0;
    record.firstAttemptAt = 0;
  }

  if (record.failedAttempts === 0) {
    record.firstAttemptAt = now;
  }

  record.failedAttempts += 1;

  if (record.failedAttempts >= MAX_ATTEMPTS) {
    record.lockoutCount += 1;
    record.lockedUntil = now + computeLockoutDuration(record.lockoutCount);
    record.failedAttempts = 0;
    record.firstAttemptAt = 0;
  }
}

function recordSuccess(key) {
  // Full reset on a genuine successful authentication.
  attemptStore.delete(key);
}

/**
 * Attempt to authenticate a user.
 *
 * @param {Object} opts
 * @param {string} opts.username          - Supplied username/identifier.
 * @param {string} opts.password          - Supplied plaintext password.
 * @param {string} [opts.ip]              - Request IP (adds to tracking key).
 * @param {Function} opts.getUser         - async (username) => userRecord|null
 *                                           userRecord must contain passwordHash.
 * @returns {Promise<{success:boolean, message:string, user?:Object}>}
 */
async function authenticate({ username, password, ip = '', getUser }) {
  const now = Date.now();

  // Track per identifier (and optionally per IP) to resist enumeration.
  const key = `${String(username).toLowerCase()}|${ip}`;
  const record = getRecord(key);

  // If currently locked, refuse without revealing the reason.
  // Do NOT indicate whether the account exists or the password is wrong.
  if (isLocked(record, now)) {
    return { success: false, message: GENERIC_ERROR };
  }

  // Always look up the user, but never leak existence via responses/timing.
  const user = typeof getUser === 'function' ? await getUser(username) : null;

  // Use a dummy hash to keep timing similar whether or not the user exists.
  const DUMMY_HASH =
    '$2b$12$C6UzMDM.H6dfI/f/IKxGhuV8ZrLDGf6Pw3nsm9k7qF3nEnFqZ9wZS';
  const hashToCompare = user && user.passwordHash ? user.passwordHash : DUMMY_HASH;

  let passwordMatches = false;
  try {
    passwordMatches = await bcrypt.compare(String(password), hashToCompare);
  } catch (_e) {
    passwordMatches = false;
  }

  // Only a real, existing user with a correct password succeeds.
  if (user && passwordMatches) {
    recordSuccess(key);
    return { success: true, message: 'Authenticated.', user };
  }

  // Any failure (bad password OR nonexistent user) increments the counter.
  recordFailure(key, now);

  // Uniform generic message regardless of the underlying cause.
  return { success: false, message: GENERIC_ERROR };
}

// Periodic cleanup of expired, empty records to bound memory usage.
function cleanupExpiredRecords(now = Date.now()) {
  for (const [key, record] of attemptStore.entries()) {
    const lockExpired = record.lockedUntil <= now;
    const windowExpired =
      !record.firstAttemptAt || now - record.firstAttemptAt > ATTEMPT_WINDOW_MS;
    if (lockExpired && windowExpired && record.failedAttempts === 0) {
      // Keep lockoutCount only while it might still influence back-off soon.
      if (record.lockedUntil + MAX_LOCKOUT_MS < now) {
        attemptStore.delete(key);
      }
    }
  }
}

const cleanupTimer = setInterval(() => cleanupExpiredRecords(), 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

// Example Express handler wiring.
function loginHandler(getUser) {
  return async function (req, res) {
    const { username, password } = req.body || {};
    if (!username || !password) {
      // Same generic response to avoid