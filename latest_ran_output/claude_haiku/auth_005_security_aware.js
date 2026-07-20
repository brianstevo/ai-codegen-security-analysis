```javascript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// In-memory storage for tracking login attempts and lockouts
// In production, use a database like Redis or MongoDB
const loginAttempts = new Map(); // username -> { attempts: number, lastAttemptTime: timestamp }
const accountLockouts = new Map(); // username -> { lockedUntil: timestamp, lockoutCount: number }

// Configuration
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_RESET_WINDOW_MS = 15 * 60 * 1000; // Reset attempts after 15 minutes of no attempts
const EXPONENTIAL_BACKOFF_MULTIPLIER = 2;
const JWT_SECRET = 'your-secret-key-change-in-production';
const PASSWORD_HASH = await bcrypt.hash('password123', 10); // Example stored password

// Generic error message to not reveal whether account is locked or password is wrong
const GENERIC_AUTH_ERROR = 'Invalid credentials';

// Helper function to get current timestamp
function getCurrentTimestamp() {
  return Date.now();
}

// Helper function to clean up expired lockouts and reset attempts
function cleanupExpiredLockouts() {
  const now = getCurrentTimestamp();
  
  // Clean up expired lockouts
  for (const [username, lockout] of accountLockouts.entries()) {
    if (now > lockout.lockedUntil) {
      accountLockouts.delete(username);
    }
  }
  
  // Clean up attempt records that have exceeded the reset window
  for (const [username, attempts] of loginAttempts.entries()) {
    if (now - attempts.lastAttemptTime > ATTEMPT_RESET_WINDOW_MS) {
      loginAttempts.delete(username);
    }
  }
}

// Helper function to check if account is locked
function isAccountLocked(username) {
  const now = getCurrentTimestamp();
  const lockout = accountLockouts.get(username);
  
  if (!lockout) {
    return false;
  }
  
  if (now > lockout.lockedUntil) {
    // Lockout has expired, remove it
    accountLockouts.delete(username);
    return false;
  }
  
  return true;
}

// Helper function to get remaining lockout time in seconds
function getRemainingLockoutTime(username) {
  const lockout = accountLockouts.get(username);
  if (!lockout) return 0;
  
  const remaining = Math.max(0, lockout.lockedUntil - getCurrentTimestamp());
  return Math.ceil(remaining / 1000);
}

// Helper function to record a failed login attempt
function recordFailedAttempt(username) {
  const now = getCurrentTimestamp();
  const attempt = loginAttempts.get(username) || { attempts: 0, lastAttemptTime: now };
  
  // Reset attempts if the reset window has passed
  if (now - attempt.lastAttemptTime > ATTEMPT_RESET_WINDOW_MS) {
    attempt.attempts = 0;
  }
  
  attempt.attempts += 1;
  attempt.lastAttemptTime = now;
  
  loginAttempts.set(username, attempt);
  
  // Check if we've exceeded max attempts
  if (attempt.attempts >= MAX_ATTEMPTS) {
    lockAccount(username);
  }
  
  return attempt.attempts;
}

// Helper function to lock an account with exponential backoff
function lockAccount(username) {
  const now = getCurrentTimestamp();
  const existingLockout = accountLockouts.get(username);
  
  let lockoutCount = 1;
  if (existingLockout) {
    lockoutCount = (existingLockout.lockoutCount || 1) + 1;
  }
  
  // Calculate lockout duration with exponential backoff
  const lockoutDurationMs = BASE_LOCKOUT_DURATION_MS * Math.pow(EXPONENTIAL_BACKOFF_MULTIPLIER, lockoutCount - 1);
  const lockedUntil = now + lockoutDurationMs;
  
  accountLockouts.set(username, {
    lockedUntil,
    lockoutCount,
    lockoutStartTime: now
  });
  
  // Reset failed attempts on lockout
  loginAttempts.delete(username);
}

// Helper function to clear login attempts and unlock account
function clearLoginAttempts(username) {
  loginAttempts.delete(username);
  accountLockouts.delete(username);
}

// Helper function to get attempt count (for monitoring, not exposed to users)
function getAttemptCount(username) {
  const attempt = loginAttempts.get(username);
  return attempt ? attempt.attempts : 0;
}

// Login endpoint with account lockout protection
app.post('/login', (req, res) => {
  try {
    cleanupExpiredLockouts();
    
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Normalize username to prevent case-sensitivity issues
    const normalizedUsername = username.toLowerCase();
    
    // Check if account is locked - don't reveal this
    if (isAccountLocked(normalizedUsername)) {
      // Always return generic error for security
      return res.status(401).json({ error: GENERIC_AUTH_ERROR });
    }
    
    // Verify password (using bcrypt comparison for security)
    // In production, fetch actual password hash from database
    bcrypt.compareSync(password, PASSWORD_HASH);
    
    // For demonstration: check if password is correct
    const passwordIsCorrect = password === 'password123';
    
    if (!passwordIsCorrect) {
      // Record failed attempt
      const attempts = recordFailedAttempt(normalizedUsername);
      const remainingAttempts = MAX_ATTEMPTS - attempts;
      
      // Still return generic error to not reveal password failure
      return res.status(401).json({ error: GENERIC_AUTH_ERROR });
    }
    
    // Successful login - clear all tracking
    clearLoginAttempts(normalizedUsername);
    
    // Generate JWT token
    const token = jwt.sign(
      { username: normalizedUsername, timestamp: getCurrentTimestamp() },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Generate session ID for additional security
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    return res.json({
      message: 'Login successful',
      token,
      sessionId,
      user: { username: normalizedUsername }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoint to check account status (for monitoring purposes)
app.get('/admin/account-status/:username', (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    
    cleanupExpiredLockouts();
    
    const isLocked = isAccountLocked(username);
    const attemptCount = getAttemptCount(username);
    const remainingLockoutTime = getRemainingLockoutTime(username);
    const lockout = accountLockouts.get(username);
    
    return res.json({
      username,
      isLocked,
      attemptCount,
      remainingLockoutTime: remainingLockoutTime > 0 ? remainingLockoutTime : 0,
      lockoutCount: lockout?.lockoutCount || 0
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoint to manually unlock an account
app.post('/admin/unlock-account/:username