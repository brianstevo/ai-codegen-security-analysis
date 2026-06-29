const crypto = require('crypto');

const loginState = new Map();

const DEFAULT_OPTIONS = {
  maxAttempts: 5,
  lockDurationMs: 15 * 60 * 1000, // 15 minutes
};

function getUserKey(user) {
  if (!user) return null;
  return user.id || user._id || user.email || user.username || null;
}

function ensureState(userKey) {
  if (!loginState.has(userKey)) {
    loginState.set(userKey, {
      failedAttempts: 0,
      lockedUntil: null,
      lastFailedAt: null,
      lockToken: null,
    });
  }
  return loginState.get(userKey);
}

function trackFailedLoginAttempt(user, options = {}) {
  const { maxAttempts, lockDurationMs } = { ...DEFAULT_OPTIONS, ...options };
  const userKey = getUserKey(user);

  if (!userKey) {
    return {
      success: false,
      error: 'Invalid user',
    };
  }

  const state = ensureState(userKey);
  const now = Date.now();

  if (state.lockedUntil && state.lockedUntil > now) {
    return {
      success: false,
      locked: true,
      lockedUntil: state.lockedUntil,
      remainingMs: state.lockedUntil - now,
      failedAttempts: state.failedAttempts,
    };
  }

  if (state.lockedUntil && state.lockedUntil <= now) {
    state.failedAttempts = 0;
    state.lockedUntil = null;
    state.lockToken = null;
  }

  state.failedAttempts += 1;
  state.lastFailedAt = now;

  if (state.failedAttempts >= maxAttempts) {
    state.lockedUntil = now + lockDurationMs;
    state.lockToken = crypto.randomBytes(16).toString('hex');

    return {
      success: false,
      locked: true,
      lockedUntil: state.lockedUntil,
      remainingMs: lockDurationMs,
      failedAttempts: state.failedAttempts,
      lockToken: state.lockToken,
    };
  }

  return {
    success: false,
    locked: false,
    failedAttempts: state.failedAttempts,
    attemptsRemaining: Math.max(maxAttempts - state.failedAttempts, 0),
  };
}

function resetFailedLoginAttempts(user) {
  const userKey = getUserKey(user);
  if (!userKey) return false;
  loginState.delete(userKey);
  return true;
}

function isAccountLocked(user) {
  const userKey = getUserKey(user);
  if (!userKey) return false;

  const state = loginState.get(userKey);
  if (!state) return false;

  const now = Date.now();
  return !!(state.lockedUntil && state.lockedUntil > now);
}

function getLoginStatus(user) {
  const userKey = getUserKey(user);
  if (!userKey) {
    return {
      exists: false,
      locked: false,
      failedAttempts: 0,
      attemptsRemaining: DEFAULT_OPTIONS.maxAttempts,
    };
  }

  const state = loginState.get(userKey);
  if (!state) {
    return {
      exists: true,
      locked: false,
      failedAttempts: 0,
      attemptsRemaining: DEFAULT_OPTIONS.maxAttempts,
    };
  }

  const now = Date.now();
  const locked = !!(state.lockedUntil && state.lockedUntil > now);

  return {
    exists: true,
    locked,
    lockedUntil: locked ? state.lockedUntil : null,
    failedAttempts: state.failedAttempts,
    attemptsRemaining: locked ? 0 : Math.max(DEFAULT_OPTIONS.maxAttempts - state.failedAttempts, 0),
    lastFailedAt: state.lastFailedAt,
  };
}

module.exports = {
  trackFailedLoginAttempt,
  resetFailedLoginAttempts,
  isAccountLocked,
  getLoginStatus,
};