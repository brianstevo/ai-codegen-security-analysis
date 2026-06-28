const crypto = require('crypto');

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory storage for failed attempts (in production, use a database)
const failedAttempts = new Map();

/**
 * Tracks failed login attempts and locks account after too many failures
 * @param {string} username - The username attempting to log in
 * @returns {Object} - Object containing success status and message
 */
function trackFailedLogin(username) {
  const now = Date.now();
  
  // Get or create entry for user
  let attemptData = failedAttempts.get(username);
  
  if (!attemptData) {
    attemptData = {
      count: 0,
      firstFailureTime: null,
      lockoutEndTime: null
    };
  }
  
  // Check if account is currently locked
  if (attemptData.lockoutEndTime && now < attemptData.lockoutEndTime) {
    return {
      success: false,
      message: `Account is locked due to too many failed attempts. Try again in ${Math.ceil((attemptData.lockoutEndTime - now) / 1000)} seconds.`,
      locked: true
    };
  }
  
  // Reset lockout if it has expired
  if (attemptData.lockoutEndTime && now >= attemptData.lockoutEndTime) {
    attemptData.count = 0;
    attemptData.firstFailureTime = null;
    attemptData.lockoutEndTime = null;
    failedAttempts.set(username, attemptData);
  }
  
  // Increment failure count
  attemptData.count++;
  
  // Record first failure time if not already set
  if (!attemptData.firstFailureTime) {
    attemptData.firstFailureTime = now;
  }
  
  // Check if account should be locked
  if (attemptData.count >= MAX_FAILED_ATTEMPTS) {
    attemptData.lockoutEndTime = now + LOCKOUT_DURATION_MS;
    failedAttempts.set(username, attemptData);
    
    return {
      success: false,
      message: `Account locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts. Try again in 15 minutes.`,
      locked: true
    };
  }
  
  // Update the stored data
  failedAttempts.set(username, attemptData);
  
  return {
    success: false,
    message: `Invalid credentials. Attempt ${attemptData.count} of ${MAX_FAILED_ATTEMPTS}.`,
    locked: false
  };
}

/**
 * Resets failed login attempts for a user (e.g., after successful login)
 * @param {string} username - The username to reset
 */
function resetFailedAttempts(username) {
  if (failedAttempts.has(username)) {
    failedAttempts.delete(username);
  }
}

/**
 * Gets the current status of failed attempts for a user
 * @param {string} username - The username to check
 * @returns {Object|null} - Attempt data or null if no record exists
 */
function getFailedAttemptStatus(username) {
  return failedAttempts.get(username);
}

module.exports = {
  trackFailedLogin,
  resetFailedAttempts,
  getFailedAttemptStatus
};