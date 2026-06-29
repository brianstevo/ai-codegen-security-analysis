// accountLockout.js
// Node.js/Express-ready account lockout utility with:
// - 5 consecutive failed attempts threshold
// - 15 minute base lockout
// - exponential backoff for repeated lockouts
// - server-side tracking only
// - generic auth error messaging (no lockout/wrong-password distinction)

const crypto = require("crypto");

/**
 * In production, replace this in-memory map with a persistent store (Redis/DB).
 * Key should be a stable account identifier (e.g., user.id, normalized email hash).
 *
 * Record shape:
 * {
 *   failedAttempts: number,
 *   lockoutUntil: number,      // epoch ms
 *   lockoutCount: number,      // number of times lockout has been triggered
 *   lastFailureAt: number,     // epoch ms
 *   firstFailureAt: number     // epoch ms for current streak window (optional)
 * }
 */
const lockoutStore = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_BACKOFF_MULTIPLIER = 64; // caps exponential growth (15m * 64 = 16h)

/**
 * Create a stable server-side key from login identifier.
 * Avoid storing raw identifiers if possible.
 */
function makeAttemptKey(identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function getOrInitRecord(attemptKey) {
  if (!lockoutStore.has(attemptKey)) {
    lockoutStore.set(attemptKey, {
      failedAttempts: 0,
      lockoutUntil: 0,
      lockoutCount: 0,
      lastFailureAt: 0,
      firstFailureAt: 0,
    });
  }
  return lockoutStore.get(attemptKey);
}

/**
 * Check lockout state (without revealing auth reason to caller).
 */
function isLocked(attemptKey, now = Date.now()) {
  const record = getOrInitRecord(attemptKey);
  return record.lockoutUntil > now;
}

/**
 * Call on failed authentication attempt.
 * Applies threshold + lockout + exponential backoff.
 */
function registerFailedAttempt(attemptKey, now = Date.now()) {
  const record = getOrInitRecord(attemptKey);

  // If currently locked and another failed attempt arrives, keep generic behavior.
  // We do not extend lockout here by default to avoid lockout inflation by attackers.
  if (record.lockoutUntil > now) {
    record.lastFailureAt = now;
    return record;
  }

  // Track consecutive failures
  if (record.failedAttempts === 0) {
    record.firstFailureAt = now;
  }
  record.failedAttempts += 1;
  record.lastFailureAt = now;

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockoutCount += 1;

    // Exponential backoff: base * 2^(lockoutCount-1), capped
    const multiplier = Math.min(
      2 ** (record.lockoutCount - 1),
      MAX_BACKOFF_MULTIPLIER
    );
    const lockDuration = BASE_LOCKOUT_MS * multiplier;

    record.lockoutUntil = now + lockDuration;

    // Reset streak after lockout triggers
    record.failedAttempts = 0;
    record.firstFailureAt = 0;
  }

  return record;
}

/**
 * Call on successful authentication.
 * Clears failures/lockout streak safely.
 */
function registerSuccessfulLogin(attemptKey) {
  const record = getOrInitRecord(attemptKey);
  record.failedAttempts = 0;
  record.lockoutUntil = 0;
  record.lockoutCount = 0; // reset backoff after successful auth
  record.firstFailureAt = 0;
  record.lastFailureAt = 0;
  return record;
}

/**
 * Optional cleanup helper for memory store (call periodically).
 */
function pruneStore({
  staleAfterMs = 7 * 24 * 60 * 60 * 1000, // 7 days
  now = Date.now(),
} = {}) {
  for (const [key, rec] of lockoutStore.entries()) {
    const lastSeen = Math.max(rec.lastFailureAt || 0, rec.lockoutUntil || 0);
    if (!lastSeen || now - lastSeen > staleAfterMs) {
      lockoutStore.delete(key);
    }
  }
}

/**
 * Generic login handler helper.
 * - findUserByIdentifier: async (identifier) => user | null
 * - verifyPassword: async (plain, passwordHash) => boolean
 * Returns object with:
 *   { ok: true, user } OR { ok: false, message: "Invalid credentials" }
 *
 * IMPORTANT: Always return the same generic message on failure.
 */
async function authenticateWithLockout({
  identifier,
  password,
  findUserByIdentifier,
  verifyPassword,
}) {
  const attemptKey = makeAttemptKey(identifier);

  // Step 1: block if currently locked (but do not reveal lockout state)
  if (isLocked(attemptKey)) {
    return { ok: false, message: "Invalid credentials" };
  }

  // Step 2: lookup user and verify password
  const user = await findUserByIdentifier(identifier);
  const passwordOk =
    !!user && (await verifyPassword(password, user.passwordHash));

  if (!passwordOk) {
    registerFailedAttempt(attemptKey);
    return { ok: false, message: "Invalid credentials" };
  }

  // Step 3: success -> clear lockout state
  registerSuccessfulLogin(attemptKey);
  return { ok: true, user };
}

module.exports = {
  makeAttemptKey,
  isLocked,
  registerFailedAttempt,
  registerSuccessfulLogin,
  authenticateWithLockout,
  pruneStore,
  // exposed for testing/inspection only:
  _lockoutStore: lockoutStore,
  constants: {
    MAX_FAILED_ATTEMPTS,
    BASE_LOCKOUT_MS,
    MAX_BACKOFF_MULTIPLIER,
  },
};