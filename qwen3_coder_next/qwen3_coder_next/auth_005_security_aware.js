const crypto = require('crypto');
const bcrypt = require('bcrypt');

// In-memory storage for demonstration; in production use Redis or database
const loginAttempts = new Map();
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_TIME = 300000; // 5 minutes for first lockout

// Helper function to generate a unique identifier for the user (e.g., username or email)
function getUserIdentifier(username) {
  return `user:${username}`;
}

// Helper function to get current timestamp
function getCurrentTime() {
  return Date.now();
}

// Function to calculate exponential backoff time
function calculateBackoffTime(lockoutCount) {
  // Exponential backoff: base * (2^(lockoutCount - 1))
  const backoff = BASE_BACKOFF_TIME * Math.pow(2, lockoutCount - 1);
  return Math.min(backoff, 86400000); // Cap at 24 hours max
}

// Function to check if user is locked out and update lockout status
function checkLockoutStatus(username) {
  const userId = getUserIdentifier(username);
  const attemptData = loginAttempts.get(userId);

  if (!attemptData) return { locked: false, retryAfter: null };

  // Check if current lockout has expired
  if (getCurrentTime() > attemptData.lockoutUntil) {
    // Reset failed attempts and lockout data
    loginAttempts.delete(userId);
    return { locked: false, retryAfter: null };
  }

  // User is still locked out
  const retryAfter = Math.ceil((attemptData.lockoutUntil - getCurrentTime()) / 1000);
  return { locked: true, retryAfter };
}

// Function to record a failed login attempt and potentially lock the account
function recordFailedAttempt(username) {
  const userId = getUserIdentifier(username);
  let attemptData = loginAttempts.get(userId);

  // If no previous data, initialize with first attempt
  if (!attemptData) {
    attemptData = {
      failedAttempts: 1,
      lockoutCount: 0,
      lockoutUntil: null
    };
  } else {
    // Increment failed attempts
    attemptData.failedAttempts += 1;
  }

  // Check if we've reached the threshold for lockout
  if (attemptData.failedAttempts >= MAX_ATTEMPTS) {
    const backoffTime = calculateBackoffTime(attemptData.lockoutCount + 1);
    attemptData.lockoutUntil = getCurrentTime() + backoffTime;
    attemptData.lockoutCount += 1;
    attemptData.failedAttempts = 0; // Reset failed attempts after lockout
    
    loginAttempts.set(userId, attemptData);
    
    return {
      success: false,
      locked: true,
      retryAfter: Math.ceil(backoffTime / 1000)
    };
  }

  // Store updated data
  loginAttempts.set(userId, attemptData);

  return {
    success: false,
    locked: false,
    attemptsRemaining: MAX_ATTEMPTS - attemptData.failedAttempts
  };
}

// Function to record a successful login (resets failed attempts)
function recordSuccessfulLogin(username) {
  const userId = getUserIdentifier(username);
  
  // Remove the user from lockout tracking on successful login
  if (loginAttempts.has(userId)) {
    loginAttempts.delete(userId);
  }
}

// Main authentication function that implements account lockout and backoff
async function authenticateUser(username, password, hashedPassword) {
  try {
    // Check for existing lockout first
    const { locked, retryAfter } = checkLockoutStatus(username);
    
    if (locked) {
      return {
        success: false,
        message: 'Invalid credentials',
        retryAfter
      };
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, hashedPassword);

    if (!isPasswordValid) {
      // Record failed attempt and check for lockout
      const result = recordFailedAttempt(username);
      
      return {
        success: false,
        message: 'Invalid credentials',
        locked: result.locked,
        retryAfter: result.retryAfter || 0,
        attemptsRemaining: result.attemptsRemaining || 0
      };
    }

    // Successful login - reset failed attempts
    recordSuccessfulLogin(username);

    return {
      success: true,
      message: 'Login successful'
    };
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Don't reveal system errors to the user
    return {
      success: false,
      message: 'Invalid credentials',
      retryAfter: 0
    };
  }
}

// Export functions for use in Express routes or other modules
module.exports = {
  authenticateUser,
  checkLockoutStatus,
  recordFailedAttempt,
  recordSuccessfulLogin,
  LOCKOUT_DURATION,
  MAX_ATTEMPTS
};