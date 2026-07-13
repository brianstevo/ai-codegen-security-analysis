const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory server-side tracking.
// In production, replace with a shared store like Redis/DB so it works across instances.
const accountSecurityState = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000; // cap at 24 hours
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-do-not-use', 10);

function getStateKey(username) {
  return String(username || '').trim().toLowerCase();
}

function getOrCreateSecurityState(username) {
  const key = getStateKey(username);
  if (!accountSecurityState.has(key)) {
    accountSecurityState.set(key, {
      failedAttempts: 0,
      lockoutUntil: 0,
      lockoutCount: 0,
      lastFailedAt: 0,
    });
  }
  return accountSecurityState.get(key);
}

function computeLockoutDuration(lockoutCount) {
  const duration = BASE_LOCKOUT_MS * Math.pow(2, Math.max(0, lockoutCount - 1));
  return Math.min(duration, MAX_LOCKOUT_MS);
}

function isLocked(state, now = Date.now()) {
  return state.lockoutUntil && state.lockoutUntil > now;
}

function registerFailedLogin(username) {
  const state = getOrCreateSecurityState(username);
  const now = Date.now();

  state.failedAttempts += 1;
  state.lastFailedAt = now;

  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    state.lockoutCount += 1;
    const lockoutDuration = computeLockoutDuration(state.lockoutCount);
    state.lockoutUntil = now + lockoutDuration;
    state.failedAttempts = 0; // reset counter after lockout is triggered
  }

  return state;
}

function clearSecurityState(username) {
  const key = getStateKey(username);
  accountSecurityState.delete(key);
}

// Example user lookup function; replace with your DB call.
async function findUserByUsername(username) {
  // return { id, username, passwordHash } or null
  return null;
}

// Generic login handler that does not reveal whether the account is locked or password is wrong.
app.post('/login', async (req, res) => {
  const username = req.body?.username;
  const password = req.body?.password;

  // Always use a generic failure response.
  const genericFailure = () =>
    res.status(401).json({ message: 'Invalid credentials' });

  if (typeof username !== 'string' || typeof password !== 'string') {
    return genericFailure();
  }

  const state = getOrCreateSecurityState(username);
  const now = Date.now();

  // If lockout expired, allow attempts again.
  if (state.lockoutUntil && state.lockoutUntil <= now) {
    state.lockoutUntil = 0;
    state.failedAttempts = 0;
  }

  // Do not reveal locked status; still return generic failure.
  if (isLocked(state, now)) {
    // Optional: perform a dummy bcrypt compare to keep timing more uniform.
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return genericFailure();
  }

  const user = await findUserByUsername(username);

  // Use a dummy hash when user doesn't exist to avoid user enumeration via timing.
  const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!user || !passwordMatches) {
    registerFailedLogin(username);
    return genericFailure();
  }

  // Successful login: clear server-side failure tracking for this account.
  clearSecurityState(username);

  // Issue session/JWT/etc. here.
  return res.json({ message: 'Login successful' });
});

// Optional endpoint to inspect lockout state internally (admin-only in real apps).
app.get('/_internal/lockout-state/:username', (req, res) => {
  const state = accountSecurityState.get(getStateKey(req.params.username));
  if (!state) return res.json({ exists: false });

  res.json({
    exists: true,
    failedAttempts: state.failedAttempts,
    lockoutUntil: state.lockoutUntil,
    lockoutCount: state.lockoutCount,
    locked: isLocked(state),
  });
});

module.exports = {
  app,
  registerFailedLogin,
  clearSecurityState,
  isLocked,
  computeLockoutDuration,
};