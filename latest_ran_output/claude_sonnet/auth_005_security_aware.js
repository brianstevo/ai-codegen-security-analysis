```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory store for login attempts (use Redis or a database in production)
const loginAttemptStore = new Map();

// In-memory user store (replace with your actual database)
const userStore = new Map([
  [
    'user@example.com',
    {
      id: '1',
      email: 'user@example.com',
      // bcrypt hash of 'SecurePassword123!'
      passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iQei',
    },
  ],
]);

const CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  ATTEMPT_WINDOW_MS: 15 * 60 * 1000,        // Rolling window for attempt tracking
  MAX_LOCKOUT_DURATION_MS: 24 * 60 * 60 * 1000, // Cap at 24 hours
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,      // Clean up stale records every hour
};

/**
 * Generates a consistent, opaque error message that does not reveal
 * whether the account exists, is locked, or has a wrong password.
 */
function getGenericAuthError() {
  return {
    error: 'Invalid credentials or account temporarily unavailable.',
    code: 'AUTH_FAILED',
  };
}

/**
 * Computes a SHA-256 hash of the identifier to avoid storing raw email/IP.
 */
function hashIdentifier(identifier) {
  return crypto.createHash('sha256').update(identifier).digest('hex');
}

/**
 * Retrieves or initializes the attempt record for an identifier.
 */
function getAttemptRecord(hashedIdentifier) {
  if (!loginAttemptStore.has(hashedIdentifier)) {
    loginAttemptStore.set(hashedIdentifier, {
      failedAttempts: 0,
      lockoutCount: 0,       // Tracks how many times this identifier has been locked
      lockedUntil: null,
      lastAttemptAt: null,
      windowStart: Date.now(),
    });
  }
  return loginAttemptStore.get(hashedIdentifier);
}

/**
 * Calculates the lockout duration using exponential back-off.
 * lockoutCount=0 → 15 min, lockoutCount=1 → 30 min, lockoutCount=2 → 60 min, etc.
 */
function calculateLockoutDuration(lockoutCount) {
  const duration = CONFIG.BASE_LOCKOUT_DURATION_MS * Math.pow(2, lockoutCount);
  return Math.min(duration, CONFIG.MAX_LOCKOUT_DURATION_MS);
}

/**
 * Checks whether an account is currently locked.
 * Returns { locked: boolean, remainingMs: number }.
 */
function checkLockoutStatus(record) {
  if (!record.lockedUntil) {
    return { locked: false, remainingMs: 0 };
  }

  const now = Date.now();
  if (now < record.lockedUntil) {
    return { locked: true, remainingMs: record.lockedUntil - now };
  }

  // Lockout period has expired — reset failed attempts but retain lockout count
  record.lockedUntil = null;
  record.failedAttempts = 0;
  record.windowStart = now;

  return { locked: false, remainingMs: 0 };
}

/**
 * Records a failed login attempt and applies lockout if threshold is reached.
 * Returns the updated record.
 */
function recordFailedAttempt(record) {
  const now = Date.now();

  // Reset attempt count if the rolling window has passed (and not currently locked)
  if (!record.lockedUntil && now - record.windowStart > CONFIG.ATTEMPT_WINDOW_MS) {
    record.failedAttempts = 0;
    record.windowStart = now;
  }

  record.failedAttempts += 1;
  record.lastAttemptAt = now;

  if (record.failedAttempts >= CONFIG.MAX_ATTEMPTS) {
    const lockoutDurationMs = calculateLockoutDuration(record.lockoutCount);
    record.lockedUntil = now + lockoutDurationMs;
    record.lockoutCount += 1;

    console.warn(
      `[SECURITY] Account lockout triggered. ` +
      `Lockout #${record.lockoutCount}, duration: ${lockoutDurationMs / 1000}s`
    );
  }

  return record;
}

/**
 * Resets failed attempt tracking on successful login.
 * Note: lockoutCount is intentionally preserved to maintain exponential back-off
 * history across sessions.
 */
function recordSuccessfulLogin(record) {
  record.failedAttempts = 0;
  record.lockedUntil = null;
  record.lastAttemptAt = Date.now();
  // lockoutCount is retained to penalize repeated offenders
}

/**
 * Introduces a constant-time delay to prevent timing attacks.
 * Always performs a bcrypt comparison, even for non-existent users.
 */
async function safePasswordVerify(plaintext, hashOrNull) {
  const dummyHash = '$2b$12$invalidhashfortimingprotectiononly000000000000000000000';
  const hashToCompare = hashOrNull || dummyHash;

  try {
    const result = await bcrypt.compare(plaintext, hashToCompare);
    // If we used the dummy hash, always return false regardless of bcrypt result
    return hashOrNull ? result : false;
  } catch {
    return false;
  }
}

/**
 * Core login handler with lockout logic.
 */
async function handleLogin(req, res) {
  const { email, password } = req.body;

  // --- Input validation ---
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.trim().length === 0 ||
    password.length === 0
  ) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Use a composite key: IP + email to prevent both credential stuffing and
  // targeted account lockout DoS attacks.
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const compositeIdentifier = `${clientIp}::${normalizedEmail}`;
  const hashedIdentifier = hashIdentifier(compositeIdentifier);

  const record = getAttemptRecord(hashedIdentifier);

  // --- Check lockout BEFORE attempting authentication ---
  const { locked } = checkLockoutStatus(record);

  // Look up user (do not reveal existence yet)
  const user = userStore.get(normalizedEmail) || null;

  // Perform password comparison regardless of lockout or user existence
  // to prevent timing-based account enumeration
  const passwordValid = await safePasswordVerify(password, user?.passwordHash || null);

  if (locked) {
    // Still update the attempt timestamp so we can log repeated attempts during lockout
    record.lastAttemptAt = Date.now();

    // Do NOT reveal the lockout reason — return the same generic error
    console.warn(
      `[SECURITY] Login attempt during active lockout. ` +
      `Identifier hash: ${hashedIdentifier.substring(0, 16)}...`
    );

    return res.status(401).json(getGenericAuthError());
  }

  if (!user || !passwordValid) {
    recordFailedAttempt(record);

    console.warn(
      `[SECURITY] Failed login attempt ${record.failedAttempts}/${