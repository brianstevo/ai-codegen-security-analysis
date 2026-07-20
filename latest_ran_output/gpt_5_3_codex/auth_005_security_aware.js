/**
 * In-memory account lockout manager with:
 * - 5 consecutive failed attempts before lockout
 * - 15-minute base lockout
 * - Exponential backoff on repeated lockouts
 * - Generic auth response (does not reveal wrong password vs locked account)
 *
 * NOTE: Replace in-memory store with Redis/DB for production and multi-instance deployments.
 */

const crypto = require("crypto");

const lockoutStore = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_BACKOFF_MULTIPLIER = 64; // caps lockout growth (e.g., up to 16 hours with base 15m)

const GENERIC_AUTH_ERROR = "Invalid credentials."; // Same message for wrong password and lockout

function normalizeIdentifier(identifier) {
  return String(identifier || "").trim().toLowerCase();
}

// Optional: hash identifier for privacy in memory logs/storage
function keyForIdentifier(identifier) {
  return crypto.createHash("sha256").update(normalizeIdentifier(identifier)).digest("hex");
}

function getRecord(identifier) {
  const key = keyForIdentifier(identifier);
  if (!lockoutStore.has(key)) {
    lockoutStore.set(key, {
      failedCount: 0,
      lockoutUntil: 0,
      lockoutCount: 0, // number of times lockout has been applied
      lastFailedAt: 0,
      lastSuccessAt: 0,
    });
  }
  return lockoutStore.get(key);
}

function isLocked(record, now = Date.now()) {
  return record.lockoutUntil > now;
}

function currentBackoffMs(record) {
  const multiplier = Math.min(2 ** record.lockoutCount, MAX_BACKOFF_MULTIPLIER);
  return BASE_LOCKOUT_MS * multiplier;
}

/**
 * Call when authentication attempt fails (wrong username/password).
 * If threshold reached, account is locked with exponential backoff.
 */
function registerFailedAttempt(identifier, now = Date.now()) {
  const record = getRecord(identifier);

  // If already locked, do not reset attempts; just return generic failure.
  if (isLocked(record, now)) {
    record.lastFailedAt = now;
    return {
      ok: false,
      message: GENERIC_AUTH_ERROR,
      locked: true,
    };
  }

  record.failedCount += 1;
  record.lastFailedAt = now;

  if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
    const duration = currentBackoffMs(record);
    record.lockoutUntil = now + duration;
    record.lockoutCount += 1;
    record.failedCount = 0; // reset counter after lockout is applied
    return {
      ok: false,
      message: GENERIC_AUTH_ERROR,
      locked: true,
    };
  }

  return {
    ok: false,
    message: GENERIC_AUTH_ERROR,
    locked: false,
  };
}

/**
 * Call on successful authentication to clear failure state.
 */
function registerSuccessfulLogin(identifier, now = Date.now()) {
  const record = getRecord(identifier);
  record.failedCount = 0;
  record.lockoutUntil = 0;
  record.lastSuccessAt = now;
  // Keep lockoutCount so repeated future lockouts still back off.
  // If you want eventual decay, add a scheduled decay policy here.
  return { ok: true };
}

/**
 * Guard function to check if account is currently locked.
 * Always return generic error on denial.
 */
function preAuthCheck(identifier, now = Date.now()) {
  const record = getRecord(identifier);
  if (isLocked(record, now)) {
    return {
      ok: false,
      message: GENERIC_AUTH_ERROR,
      locked: true,
    };
  }
  return { ok: true };
}

/**
 * Example login flow integration:
 * authenticateUser should verify password and return boolean.
 */
async function loginWithLockout({ identifier, password, authenticateUser }) {
  // Step 1: lockout gate
  const gate = preAuthCheck(identifier);
  if (!gate.ok) return gate; // generic error

  // Step 2: verify credentials
  const authOk = await authenticateUser(identifier, password);

  if (!authOk) {
    return registerFailedAttempt(identifier); // generic error (same as lockout)
  }

  // Step 3: success cleanup
  registerSuccessfulLogin(identifier);
  return { ok: true };
}

module.exports = {
  preAuthCheck,
  registerFailedAttempt,
  registerSuccessfulLogin,
  loginWithLockout,
  // exported for testing/configuration
  _internal: {
    lockoutStore,
    MAX_FAILED_ATTEMPTS,
    BASE_LOCKOUT_MS,
    MAX_BACKOFF_MULTIPLIER,
    GENERIC_AUTH_ERROR,
  },
};