```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * In-memory store for login attempt tracking.
 * In production, use Redis or a persistent database.
 *
 * Structure:
 * {
 *   [identifier]: {
 *     failedAttempts: number,
 *     lockoutCount: number,       // how many times this account has been locked
 *     lockedUntil: Date | null,
 *     lastAttempt: Date,
 *   }
 * }
 */
const loginAttemptStore = new Map();

// Simulated user database
const userDatabase = new Map([
  [
    'alice@example.com',
    {
      id: '1',
      email: 'alice@example.com',
      // bcrypt hash of "SecurePassword123!"
      passwordHash: '$2b$12$KIXn7VGGzQ9RkG0VxLJnW.Qz8QKJwXn2yV4tH5aM3pLdRkXmN6e4e',
    },
  ],
]);

const CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  BASE_LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  MAX_LOCKOUT_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours cap
  EXPONENTIAL_BASE: 2,
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // Clean up stale entries every hour
  STALE_ENTRY_AGE_MS: 25 * 60 * 60 * 1000, // Remove entries older than 25 hours
};

/**
 * Generic error message used for all authentication failures.
 * This prevents user enumeration and lockout status disclosure.
 */
const GENERIC_AUTH_ERROR = {
  error: 'Invalid credentials or account unavailable.',
  code: 'AUTH_FAILED',
};

/**
 * Computes a stable identifier for rate-limiting based on
 * both IP address and the submitted username/email.
 * Using both prevents attackers from bypassing per-IP limits
 * by rotating IPs, and per-account limits by rotating usernames.
 */
function buildIdentifier(ip, username) {
  const normalized = (username || '').toLowerCase().trim();
  const raw = `${ip}::${normalized}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Calculates lockout duration using exponential back-off.
 * lockoutCount = number of previous lockouts for this identifier.
 *
 * Duration = BASE * (EXPONENTIAL_BASE ^ lockoutCount), capped at MAX.
 */
function calculateLockoutDuration(lockoutCount) {
  const multiplier = Math.pow(CONFIG.EXPONENTIAL_BASE, lockoutCount);
  const duration = CONFIG.BASE_LOCKOUT_DURATION_MS * multiplier;
  return Math.min(duration, CONFIG.MAX_LOCKOUT_DURATION_MS);
}

/**
 * Retrieves or initializes tracking record for an identifier.
 */
function getTrackingRecord(identifier) {
  if (!loginAttemptStore.has(identifier)) {
    loginAttemptStore.set(identifier, {
      failedAttempts: 0,
      lockoutCount: 0,
      lockedUntil: null,
      lastAttempt: null,
    });
  }
  return loginAttemptStore.get(identifier);
}

/**
 * Checks whether the given identifier is currently locked out.
 * Returns { locked: boolean, remainingMs: number }.
 * Does NOT distinguish reason — caller must not reveal this externally.
 */
function checkLockoutStatus(identifier) {
  const record = getTrackingRecord(identifier);
  const now = Date.now();

  if (record.lockedUntil && now < record.lockedUntil.getTime()) {
    return {
      locked: true,
      remainingMs: record.lockedUntil.getTime() - now,
    };
  }

  // Lockout period has expired — reset failed attempts but keep lockoutCount
  if (record.lockedUntil && now >= record.lockedUntil.getTime()) {
    record.lockedUntil = null;
    record.failedAttempts = 0;
    // lockoutCount is intentionally NOT reset here so exponential back-off persists
  }

  return { locked: false, remainingMs: 0 };
}

/**
 * Records a failed login attempt. Triggers lockout if threshold is reached.
 */
function recordFailedAttempt(identifier) {
  const record = getTrackingRecord(identifier);
  record.failedAttempts += 1;
  record.lastAttempt = new Date();

  if (record.failedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
    const duration = calculateLockoutDuration(record.lockoutCount);
    record.lockedUntil = new Date(Date.now() + duration);
    record.lockoutCount += 1;

    // Log internally for monitoring/alerting (never expose to client)
    console.warn(
      `[SECURITY] Lockout triggered | identifier_hash=${identifier.slice(0, 12)}... | ` +
        `lockoutCount=${record.lockoutCount} | duration=${duration / 1000}s | ` +
        `lockedUntil=${record.lockedUntil.toISOString()}`
    );
  }
}

/**
 * Resets failed attempt tracking on successful login.
 * lockoutCount is also reset on successful login to allow
 * legitimate users to start fresh after recovering access.
 */
function recordSuccessfulLogin(identifier) {
  const record = getTrackingRecord(identifier);
  record.failedAttempts = 0;
  record.lockoutCount = 0;
  record.lockedUntil = null;
  record.lastAttempt = new Date();
}

/**
 * Extracts the real client IP, accounting for proxies.
 * Configure trusted proxies appropriately in production.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '0.0.0.0';
}

/**
 * Adds a timing-safe delay to prevent timing attacks that could
 * reveal whether an account exists (by short-circuiting the hash check).
 * Always runs bcrypt regardless of whether user exists.
 */
async function performTimingSafePasswordCheck(candidatePassword, storedHash) {
  // Dummy hash used when user doesn't exist to ensure consistent timing
  const DUMMY_HASH = '$2b$12$invalidhashusedfortimingsafety.XXXXXXXXXXXXXXXXXXXXXX';
  const hashToCheck = storedHash || DUMMY_HASH;

  try {
    return await bcrypt.compare(candidatePassword, hashToCheck);
  } catch {
    return false;
  }
}

/**
 * Middleware: Applies lockout check before processing login.
 * Immediately rejects locked identifiers with a generic message.
 * Uses constant-time response to avoid timing side-channels on lockout detection.
 */
async function lockoutMiddleware(req, res, next) {
  const ip = getClientIp(req);
  const { username } = req.body || {};

  if (!username) {
    return res.status(400).json({ error: 'Username is required.', code: 'MISSING_CREDENTIALS' });
  }

  const identifier = buildIdentifier(ip, username);
  const { locked, remainingMs } = checkLockoutStatus(identifier);

  if (locked) {
    // Perform a dummy bcrypt operation to ensure consistent response timing
    // whether the block is due to lockout or wrong password
    await bcrypt.compare('dummy_