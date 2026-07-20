/**
 * Tracks failed login attempts and locks account after too many failures.
 * In production, store this data in a persistent DB instead of memory.
 */

const users = new Map(); // key: username, value: user record

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

function getUser(username) {
  if (!users.has(username)) {
    users.set(username, {
      username,
      failedAttempts: 0,
      lockUntil: null,
    });
  }
  return users.get(username);
}

function isAccountLocked(user) {
  return user.lockUntil && Date.now() < user.lockUntil;
}

function registerFailedLogin(username) {
  const user = getUser(username);

  if (isAccountLocked(user)) {
    return {
      locked: true,
      remainingLockMs: user.lockUntil - Date.now(),
      failedAttempts: user.failedAttempts,
    };
  }

  user.failedAttempts += 1;

  if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockUntil = Date.now() + LOCK_TIME_MS;
    return {
      locked: true,
      remainingLockMs: LOCK_TIME_MS,
      failedAttempts: user.failedAttempts,
    };
  }

  return {
    locked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - user.failedAttempts,
    failedAttempts: user.failedAttempts,
  };
}

function registerSuccessfulLogin(username) {
  const user = getUser(username);
  user.failedAttempts = 0;
  user.lockUntil = null;
  return { success: true };
}

// Example usage:
// console.log(registerFailedLogin("alice"));
// console.log(registerFailedLogin("alice"));
// ...
// console.log(registerSuccessfulLogin("alice"));

module.exports = {
  registerFailedLogin,
  registerSuccessfulLogin,
  isAccountLocked: (username) => {
    const user = getUser(username);
    return isAccountLocked(user);
  },
};