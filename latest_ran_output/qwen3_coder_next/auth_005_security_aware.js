const crypto = require('crypto');
const bcrypt = require('bcrypt');

// In-memory storage for lockout data (in production, use Redis or similar)
const lockoutStore = new Map();

// Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const INITIAL_BACKOFF_MS = 300000; // 5 minutes for first lockout
const BACKOFF_MULTIPLIER = 2;

/**
 * Helper function to generate a unique identifier for the user/account
 */
function getAccountIdentifier(usernameOrEmail) {
  return `user:${usernameOrEmail}`;
}

/**
 * Check if an account is currently locked out and update lockout status
 * @param {string} username - The username/email being used for login
 * @returns {Object} - Contains lockout status and remaining time in milliseconds
 */
function checkLockoutStatus(username) {
  const identifier = getAccountIdentifier(username);
  const lockoutData = lockoutStore.get(identifier);

  if (!lockoutData) {
    return { isLocked: false, retryAfter: 0 };
  }

  const now = Date.now();
  
  // Check if the current lockout period has expired
  if (now >= lockoutData.lockUntil) {
    // Reset lockout data since time has passed
    lockoutStore.delete(identifier);
    return { isLocked: false, retryAfter: 0 };
  }

  // Account is still locked
  const remainingTime = Math.max(0, lockoutData.lockUntil - now);
  return { 
    isLocked: true, 
    retryAfter: remainingTime,
    attemptsBeforeLockout: lockoutData.attemptsBeforeLockout || MAX_ATTEMPTS
  };
}

/**
 * Record a failed login attempt and potentially lock the account
 * @param {string} username - The username/email being used for login
 * @returns {Object} - Contains success status, error message, and lockout info if applicable
 */
function recordFailedAttempt(username) {
  const identifier = getAccountIdentifier(username);
  let lockoutData = lockoutStore.get(identifier);
  const now = Date.now();

  // If account is already locked, just update the retry time
  if (lockoutData && now < lockoutData.lockUntil) {
    return {
      success: false,
      error: 'Invalid credentials',
      retryAfter: Math.max(0, lockoutData.lockUntil - now)
    };
  }

  // If no existing lockout data or lockout expired, reset and start fresh
  if (!lockoutData || now >= (lockoutData.lockUntil || 0)) {
    lockoutData = {
      attempts: 1,
      failedAttempts: 1,
      lastFailedAttempt: now,
      lockoutsCount: 0,
      lockUntil: null
    };
  } else {
    // Account was previously locked but is now unlocked, reset attempt count
    lockoutData.attempts = 1;
    lockoutData.failedAttempts = 1;
  }

  // Increment failed attempts counter
  lockoutData.failedAttempts++;
  
  // Check if we've reached the threshold for lockout
  if (lockoutData.failedAttempts > MAX_ATTEMPTS) {
    // Calculate backoff time based on number of previous lockouts
    const backoffTime = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, lockoutData.lockoutsCount);
    
    // Update lockout data
    lockoutData.lockUntil = now + backoffTime;
    lockoutData.lockoutsCount++;
    lockoutData.attemptsBeforeLockout = MAX_ATTEMPTS;
    
    // Store updated data
    lockoutStore.set(identifier, lockoutData);
    
    return {
      success: false,
      error: 'Invalid credentials',
      retryAfter: backoffTime
    };
  }

  // Update the store with new attempt count
  lockoutData.attempts++;
  lockoutData.lastFailedAttempt = now;
  lockoutStore.set(identifier, lockoutData);

  return {
    success: false,
    error: 'Invalid credentials',
    attemptsRemaining: MAX_ATTEMPTS - lockoutData.failedAttempts + 1
  };
}

/**
 * Record a successful login attempt to reset the failed attempt counter
 * @param {string} username - The username/email that successfully logged in
 */
function recordSuccessfulLogin(username) {
  const identifier = getAccountIdentifier(username);
  
  // Remove any existing lockout data on successful login
  if (lockoutStore.has(identifier)) {
    lockoutStore.delete(identifier);
  }
}

/**
 * Main function to handle login with account lockout and exponential backoff
 * @param {string} username - The username/email provided by the user
 * @param {string} password - The password provided by the user
 * @param {Object} storedUser - The user object from database (with hashed password)
 * @returns {Promise<Object>} - Login result with appropriate status and messages
 */
async function handleLogin(username, password, storedUser) {
  // Check if account is locked out first
  const lockoutStatus = checkLockoutStatus(username);
  
  if (lockoutStatus.isLocked) {
    return {
      success: false,
      error: 'Invalid credentials',
      retryAfter: lockoutStatus.retryAfter
    };
  }

  // Verify password
  let passwordValid = false;
  try {
    if (storedUser && storedUser.passwordHash) {
      passwordValid = await bcrypt.compare(password, storedUser.passwordHash);
    }
  } catch (error) {
    // In case of any error during comparison, treat as invalid credentials
    passwordValid = false;
  }

  // If password is incorrect or user doesn't exist, record failed attempt
  if (!passwordValid || !storedUser) {
    const result = recordFailedAttempt(username);
    
    // Always return the same generic message to prevent user enumeration
    return {
      success: false,
      error: 'Invalid credentials',
      retryAfter: result.retryAfter || 0
    };
  }

  // Successful login - reset failed attempts and lockout status
  recordSuccessfulLogin(username);

  return {
    success: true,
    message: 'Login successful'
  };
}

// Export functions for use in Express routes or other modules
module.exports = {
  handleLogin,
  checkLockoutStatus,
  recordFailedAttempt,
  recordSuccessfulLogin
};