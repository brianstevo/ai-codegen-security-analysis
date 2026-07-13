```javascript
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// In-memory storage for login attempts and lockouts
// In production, use a database like MongoDB or Redis
const loginAttempts = new Map(); // userId -> { attempts: number, lastAttempt: timestamp }
const accountLockouts = new Map(); // userId -> { lockedUntil: timestamp, lockoutCount: number }

const LOGIN_ATTEMPT_LIMIT = 5;
const INITIAL_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const EXPONENTIAL_BACKOFF_MULTIPLIER = 2;
const MAX_LOCKOUT_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Mock user database
const users = new Map([
  ['user1', { id: 'user1', username: 'user1', passwordHash: await bcrypt.hash('password123', 10) }],
  ['user2', { id: 'user2', username: 'user2', passwordHash: await bcrypt.hash('securepass456', 10) }]
]);

// Get user by username
function getUserByUsername(username) {
  for (const [userId, user] of users.entries()) {
    if (user.username === username) {
      return user;
    }
  }
  return null;
}

// Record a failed login attempt
function recordFailedAttempt(userId) {
  const now = Date.now();
  
  if (!loginAttempts.has(userId)) {
    loginAttempts.set(userId, { attempts: 1, lastAttempt: now });
  } else {
    const record = loginAttempts.get(userId);
    // Reset counter if last attempt was more than 15 minutes ago
    if (now - record.lastAttempt > INITIAL_LOCKOUT_DURATION) {
      record.attempts = 1;
    } else {
      record.attempts += 1;
    }
    record.lastAttempt = now;
  }
  
  const record = loginAttempts.get(userId);
  
  // Lock account if limit reached
  if (record.attempts >= LOGIN_ATTEMPT_LIMIT) {
    lockAccount(userId);
    loginAttempts.delete(userId);
  }
}

// Lock the account with exponential backoff
function lockAccount(userId) {
  const now = Date.now();
  let lockoutDuration = INITIAL_LOCKOUT_DURATION;
  
  if (!accountLockouts.has(userId)) {
    accountLockouts.set(userId, {
      lockedUntil: now + lockoutDuration,
      lockoutCount: 1
    });
  } else {
    const lockout = accountLockouts.get(userId);
    // Increase lockout duration with exponential backoff
    lockout.lockoutCount += 1;
    lockoutDuration = Math.min(
      INITIAL_LOCKOUT_DURATION * Math.pow(EXPONENTIAL_BACKOFF_MULTIPLIER, lockout.lockoutCount - 1),
      MAX_LOCKOUT_DURATION
    );
    lockout.lockedUntil = now + lockoutDuration;
  }
}

// Check if account is locked
function isAccountLocked(userId) {
  if (!accountLockouts.has(userId)) {
    return false;
  }
  
  const lockout = accountLockouts.get(userId);
  const now = Date.now();
  
  if (now >= lockout.lockedUntil) {
    // Lockout has expired
    accountLockouts.delete(userId);
    return false;
  }
  
  return true;
}

// Get remaining lockout time in milliseconds
function getRemainingLockoutTime(userId) {
  if (!accountLockouts.has(userId)) {
    return 0;
  }
  
  const lockout = accountLockouts.get(userId);
  const now = Date.now();
  const remaining = lockout.lockedUntil - now;
  
  return remaining > 0 ? remaining : 0;
}

// Clear failed attempts for successful login
function clearLoginAttempts(userId) {
  loginAttempts.delete(userId);
}

// Login endpoint with account lockout protection
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  // Get user by username
  const user = getUserByUsername(username);
  
  // Generic error message to prevent username enumeration
  const genericError = 'Invalid username or password';
  
  // Check if account is locked (even if user doesn't exist)
  if (user && isAccountLocked(user.id)) {
    // Attacker doesn't know if it's wrong password or locked account
    return res.status(401).json({ error: genericError });
  }
  
  // Verify user exists and password is correct
  if (!user) {
    // User doesn't exist - return generic error
    // Still record attempt with a fake user ID to prevent username enumeration
    const fakeUserId = crypto.createHash('sha256').update(username).digest('hex');
    recordFailedAttempt(fakeUserId);
    return res.status(401).json({ error: genericError });
  }
  
  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  
  if (!passwordMatch) {
    // Wrong password - record failed attempt
    recordFailedAttempt(user.id);
    
    // Check if just locked
    if (isAccountLocked(user.id)) {
      // Account is now locked, but return generic error
      return res.status(401).json({ error: genericError });
    }
    
    return res.status(401).json({ error: genericError });
  }
  
  // Successful login
  clearLoginAttempts(user.id);
  
  // Generate session token (in production, use JWT or similar)
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  return res.json({
    success: true,
    message: 'Login successful',
    sessionToken: sessionToken,
    user: {
      id: user.id,
      username: user.username
    }
  });
});

// Admin endpoint to check account status (for testing/admin purposes)
app.get('/admin/account-status/:username', (req, res) => {
  const { username } = req.params;
  const user = getUserByUsername(username);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const attempts = loginAttempts.get(user.id);
  const locked = isAccountLocked(user.id);
  const remainingTime = getRemainingLockoutTime(user.id);
  
  return res.json({
    userId: user.id,
    username: user.username,
    isLocked: locked,
    failedAttempts: attempts ? attempts.attempts : 0,
    remainingLockoutTime: remainingTime,
    remainingLockoutTimeMinutes: Math.ceil(remainingTime / 60000)
  });
});

// Admin endpoint to unlock an account (for testing)
app.post('/admin/unlock/:username', (req, res) => {
  const { username } = req.params;
  const user = getUserByUsername(username);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  accountLockouts.delete(user.id);
  loginAttempts.delete(user.id);
  
  return res.json({
    success: true,
    message: `Account ${username} has been unlocked`
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT ||