const crypto = require('crypto');

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

// In-memory storage for failed attempts (in production, use a database)
const failedAttempts = new Map();

/**
 * Check if an account is locked
 * @param {string} username - The username to check
 * @returns {boolean} - True if the account is locked
 */
function isAccountLocked(username) {
  const attemptData = failedAttempts.get(username);
  
  if (!attemptData) return false;
  
  // Check if lockout period has expired
  if (Date.now() > attemptData.lockUntil) {
    // Reset after lockout expires
    failedAttempts.delete(username);
    return false;
  }
  
  return true;
}

/**
 * Record a failed login attempt and potentially lock the account
 * @param {string} username - The username that failed to log in
 * @returns {{locked: boolean, attemptsRemaining: number}} - Object with lock status and remaining attempts
 */
function recordFailedAttempt(username) {
  // Get current attempt data or initialize new entry
  let attemptData = failedAttempts.get(username);
  
  if (!attemptData) {
    attemptData = {
      count: 0,
      lockUntil: null,
      lastAttempt: null
    };
  }
  
  // Increment the failed attempt counter
  attemptData.count += 1;
  attemptData.lastAttempt = Date.now();
  
  let locked = false;
  let attemptsRemaining = MAX_FAILED_ATTEMPTS - attemptData.count;
  
  // Check if account should be locked
  if (attemptData.count >= MAX_FAILED_ATTEMPTS) {
    attemptData.lockUntil = Date.now() + LOCK_DURATION_MS;
    locked = true;
    attemptsRemaining = 0;
    
    // Store the updated data
    failedAttempts.set(username, attemptData);
    
    return { locked, attemptsRemaining };
  }
  
  // Update the stored data
  failedAttempts.set(username, attemptData);
  
  return { locked, attemptsRemaining };
}

/**
 * Reset failed login attempts for a user (e.g., after successful login)
 * @param {string} username - The username to reset
 */
function resetFailedAttempts(username) {
  failedAttempts.delete(username);
}

// Example usage in an Express route handler:
/*
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Check if account is locked
  if (isAccountLocked(username)) {
    return res.status(423).json({ error: 'Account is temporarily locked due to too many failed attempts' });
  }
  
  // Verify credentials (example)
  const user = await findUserByUsername(username);
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    const { locked, attemptsRemaining } = recordFailedAttempt(username);
    
    if (locked) {
      return res.status(423).json({ 
        error: 'Account is temporarily locked due to too many failed attempts',
        attemptsRemaining
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid username or password',
      attemptsRemaining
    });
  }
  
  // Successful login - reset failed attempts
  resetFailedAttempts(username);
  
  // Generate and return JWT token, etc.
});
*/

module.exports = {
  isAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts
};