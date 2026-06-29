```javascript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// In-memory store for user accounts and failed attempts
// In production, this would be a database
const users = new Map();
const failedAttempts = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const JWT_SECRET = 'your-secret-key-change-this';

// Initialize a user account
async function createUser(username, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  users.set(username, {
    password: hashedPassword,
    isLocked: false,
    lockUntil: null
  });
  failedAttempts.set(username, {
    count: 0,
    firstAttemptTime: null
  });
}

// Check if account is locked and handle lockout expiration
function checkAccountLock(username) {
  const user = users.get(username);
  if (!user) return { isLocked: false };

  if (user.isLocked && user.lockUntil) {
    const now = new Date();
    if (now >= user.lockUntil) {
      // Lockout period has expired, unlock the account
      user.isLocked = false;
      user.lockUntil = null;
      const attempts = failedAttempts.get(username);
      if (attempts) {
        attempts.count = 0;
        attempts.firstAttemptTime = null;
      }
      return { isLocked: false };
    }
  }

  return {
    isLocked: user.isLocked,
    lockUntil: user.lockUntil,
    minutesRemaining: user.isLocked && user.lockUntil
      ? Math.ceil((user.lockUntil - new Date()) / 60000)
      : null
  };
}

// Record a failed login attempt
function recordFailedAttempt(username) {
  const attempts = failedAttempts.get(username);
  if (!attempts) return;

  const now = new Date();

  // Reset counter if more than 30 minutes have passed since first attempt
  if (attempts.firstAttemptTime && (now - attempts.firstAttemptTime) > 30 * 60 * 1000) {
    attempts.count = 1;
    attempts.firstAttemptTime = now;
    return;
  }

  attempts.count++;
  if (!attempts.firstAttemptTime) {
    attempts.firstAttemptTime = now;
  }

  // Lock account if max attempts reached
  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    const user = users.get(username);
    if (user) {
      user.isLocked = true;
      user.lockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }
  }
}

// Reset failed attempts on successful login
function resetFailedAttempts(username) {
  const attempts = failedAttempts.get(username);
  if (attempts) {
    attempts.count = 0;
    attempts.firstAttemptTime = null;
  }
}

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check if account is locked
  const lockStatus = checkAccountLock(username);
  if (lockStatus.isLocked) {
    return res.status(423).json({
      error: 'Account is locked due to too many failed login attempts',
      minutesRemaining: lockStatus.minutesRemaining
    });
  }

  // Check if user exists
  const user = users.get(username);
  if (!user) {
    recordFailedAttempt(username);
    const attempts = failedAttempts.get(username);
    return res.status(401).json({
      error: 'Invalid username or password',
      attemptsRemaining: MAX_FAILED_ATTEMPTS - (attempts?.count || 0)
    });
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    recordFailedAttempt(username);
    const attempts = failedAttempts.get(username);
    const remaining = MAX_FAILED_ATTEMPTS - attempts.count;

    if (attempts.count >= MAX_FAILED_ATTEMPTS) {
      return res.status(423).json({
        error: 'Account is now locked due to too many failed login attempts',
        lockoutDuration: `${LOCKOUT_DURATION_MINUTES} minutes`
      });
    }

    return res.status(401).json({
      error: 'Invalid username or password',
      attemptsRemaining: remaining
    });
  }

  // Successful login - reset failed attempts
  resetFailedAttempts(username);

  // Create JWT token
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });

  res.json({
    message: 'Login successful',
    token,
    username
  });
});

// Account status endpoint
app.get('/account-status/:username', (req, res) => {
  const { username } = req.params;
  const lockStatus = checkAccountLock(username);
  const attempts = failedAttempts.get(username);

  res.json({
    username,
    isLocked: lockStatus.isLocked,
    failedAttempts: attempts?.count || 0,
    attemptsAllowed: MAX_FAILED_ATTEMPTS,
    lockoutMinutesRemaining: lockStatus.minutesRemaining,
    lockoutExpiresAt: lockStatus.lockUntil
  });
});

// Unlock account endpoint (admin function)
app.post('/unlock-account/:username', (req, res) => {
  const { username } = req.params;
  const user = users.get(username);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.isLocked = false;
  user.lockUntil = null;
  const attempts = failedAttempts.get(username);
  if (attempts) {
    attempts.count = 0;
    attempts.firstAttemptTime = null;
  }

  res.json({ message: `Account ${username} has been unlocked` });
});

// Register endpoint for testing
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (users.has(username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  await createUser(username, password);
  res.status(201).json({ message: 'User registered successfully', username });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Login attempt tracker server running on port ${PORT}`);
});

// Example usage for testing
async function testLoginAttempts() {
  // Create a test user
  await createUser('testuser', 'password123');

  console.log('Test user created: testuser');
  console.log('Testing failed login attempts...\n');

  // Simulate failed login attempts
  for (let i = 1; i <= 6; i++) {
    const lockStatus = checkAccountLock('testuser');
    const attempts = failedAttempts.get('testuser');

    console.log(`Attempt ${i}:`);
    console.log(`  Account locked: ${lockStatus.isLocked}`);