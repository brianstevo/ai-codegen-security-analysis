```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Configuration
const CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 15,
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_EXPIRES_IN: '1h',
  BCRYPT_ROUNDS: 12,
  UNLOCK_TOKEN_EXPIRES_MINUTES: 60,
};

// In-memory store (replace with a real database in production)
const users = new Map();
const loginAttempts = new Map();
const unlockTokens = new Map();

// Helper: Get or initialize login attempt record
function getLoginAttemptRecord(identifier) {
  if (!loginAttempts.has(identifier)) {
    loginAttempts.set(identifier, {
      count: 0,
      lastAttempt: null,
      lockedUntil: null,
      history: [],
    });
  }
  return loginAttempts.get(identifier);
}

// Helper: Check if account is currently locked
function isAccountLocked(record) {
  if (!record.lockedUntil) return false;
  if (new Date() < new Date(record.lockedUntil)) return true;
  // Lock has expired, reset the record
  record.lockedUntil = null;
  record.count = 0;
  return false;
}

// Helper: Get remaining lock time in seconds
function getRemainingLockTime(record) {
  if (!record.lockedUntil) return 0;
  const remaining = new Date(record.lockedUntil) - new Date();
  return Math.max(0, Math.ceil(remaining / 1000));
}

// Helper: Record a failed login attempt
function recordFailedAttempt(identifier, ipAddress, userAgent) {
  const record = getLoginAttemptRecord(identifier);

  record.count += 1;
  record.lastAttempt = new Date().toISOString();
  record.history.push({
    timestamp: new Date().toISOString(),
    ipAddress,
    userAgent,
    success: false,
  });

  // Keep only last 20 history entries
  if (record.history.length > 20) {
    record.history = record.history.slice(-20);
  }

  // Lock the account if max attempts exceeded
  if (record.count >= CONFIG.MAX_FAILED_ATTEMPTS) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + CONFIG.LOCK_DURATION_MINUTES);
    record.lockedUntil = lockUntil.toISOString();

    console.warn(
      `[SECURITY] Account locked for identifier: ${identifier}. ` +
      `Failed attempts: ${record.count}. ` +
      `Locked until: ${record.lockedUntil}. ` +
      `IP: ${ipAddress}`
    );
  }

  loginAttempts.set(identifier, record);

  return {
    failedAttempts: record.count,
    remainingAttempts: Math.max(0, CONFIG.MAX_FAILED_ATTEMPTS - record.count),
    isLocked: isAccountLocked(record),
    lockedUntil: record.lockedUntil,
  };
}

// Helper: Reset login attempts on successful login
function resetLoginAttempts(identifier, ipAddress, userAgent) {
  const record = getLoginAttemptRecord(identifier);

  record.history.push({
    timestamp: new Date().toISOString(),
    ipAddress,
    userAgent,
    success: true,
  });

  record.count = 0;
  record.lockedUntil = null;
  record.lastAttempt = new Date().toISOString();

  // Keep only last 20 history entries
  if (record.history.length > 20) {
    record.history = record.history.slice(-20);
  }

  loginAttempts.set(identifier, record);
}

// Helper: Generate unlock token
function generateUnlockToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CONFIG.UNLOCK_TOKEN_EXPIRES_MINUTES);

  unlockTokens.set(token, {
    username,
    expiresAt: expiresAt.toISOString(),
    used: false,
  });

  return token;
}

// Main login function with account lockout tracking
async function authenticateUser(username, password, ipAddress, userAgent) {
  const result = {
    success: false,
    token: null,
    message: '',
    attemptsInfo: null,
  };

  // Validate inputs
  if (!username || !password) {
    result.message = 'Username and password are required.';
    return result;
  }

  // Get login attempt record
  const record = getLoginAttemptRecord(username);

  // Check if account is locked
  if (isAccountLocked(record)) {
    const remainingSeconds = getRemainingLockTime(record);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    result.message = `Account is temporarily locked due to too many failed login attempts. ` +
      `Please try again in ${remainingMinutes} minute(s) or unlock your account via email.`;
    result.attemptsInfo = {
      isLocked: true,
      lockedUntil: record.lockedUntil,
      remainingLockSeconds: remainingSeconds,
    };

    console.warn(
      `[SECURITY] Login attempt on locked account: ${username}. ` +
      `IP: ${ipAddress}. Remaining lock: ${remainingSeconds}s`
    );

    return result;
  }

  // Find user
  const user = users.get(username);

  if (!user) {
    // Record failed attempt (use generic identifier to prevent user enumeration in logs,
    // but still track by username for lockout purposes)
    const attemptsInfo = recordFailedAttempt(username, ipAddress, userAgent);
    result.message = 'Invalid username or password.';
    result.attemptsInfo = attemptsInfo;

    if (attemptsInfo.isLocked) {
      result.message = `Too many failed attempts. Account locked for ${CONFIG.LOCK_DURATION_MINUTES} minutes.`;
    } else {
      result.message = `Invalid username or password. ${attemptsInfo.remainingAttempts} attempt(s) remaining before lockout.`;
    }

    return result;
  }

  // Check if user account is manually disabled
  if (user.isDisabled) {
    result.message = 'Your account has been disabled. Please contact support.';
    return result;
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    const attemptsInfo = recordFailedAttempt(username, ipAddress, userAgent);
    result.attemptsInfo = attemptsInfo;

    if (attemptsInfo.isLocked) {
      result.message = `Too many failed login attempts. Account locked for ${CONFIG.LOCK_DURATION_MINUTES} minutes. ` +
        `An unlock link has been sent to your email (${maskEmail(user.email)}).`;
      // In production, send unlock email here
      const unlockToken = generateUnlockToken(username);
      console.info(`[INFO] Unlock token for ${username}: ${unlockToken}`); // Remove in production
    } else {
      result.message = `Invalid username or password. ` +
        `${attemptsInfo.remainingAttempts} attempt(s) remaining before account lockout.`;
    }

    return result;
  }

  // Successful authentication
  resetLoginAttempts(username, ipAddress, userAgent);

  // Generate JWT
  const token = jwt.sign(
    {