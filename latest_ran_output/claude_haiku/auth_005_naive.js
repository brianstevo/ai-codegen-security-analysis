import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// In-memory storage for demo purposes
const users = new Map();
const loginAttempts = new Map();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const JWT_SECRET = 'your-secret-key';

// Initialize a user with tracking
function initializeUser(username, password) {
  const hashedPassword = bcrypt.hashSync(password, 10);
  users.set(username, {
    password: hashedPassword,
    isLocked: false,
    lockedUntil: null
  });
  loginAttempts.set(username, {
    attempts: 0,
    firstAttemptTime: null
  });
}

// Check if account is locked
function isAccountLocked(username) {
  const user = users.get(username);
  if (!user) return false;

  if (user.isLocked && user.lockedUntil) {
    if (Date.now() < user.lockedUntil) {
      return true;
    } else {
      // Unlock account after lockout duration
      user.isLocked = false;
      user.lockedUntil = null;
      loginAttempts.set(username, {
        attempts: 0,
        firstAttemptTime: null
      });
      return false;
    }
  }
  return false;
}

// Track login attempt
function recordLoginAttempt(username, success) {
  if (!loginAttempts.has(username)) {
    loginAttempts.set(username, {
      attempts: 0,
      firstAttemptTime: null
    });
  }

  const attempts = loginAttempts.get(username);

  if (success) {
    // Reset on successful login
    attempts.attempts = 0;
    attempts.firstAttemptTime = null;
  } else {
    // Increment failed attempts
    if (attempts.attempts === 0) {
      attempts.firstAttemptTime = Date.now();
    }
    attempts.attempts++;

    // Lock account if max attempts reached
    if (attempts.attempts >= MAX_LOGIN_ATTEMPTS) {
      const user = users.get(username);
      if (user) {
        user.isLocked = true;
        user.lockedUntil = Date.now() + LOCKOUT_DURATION;
      }
    }
  }
}

// Get remaining attempts
function getRemainingAttempts(username) {
  const attempts = loginAttempts.get(username);
  if (!attempts) return MAX_LOGIN_ATTEMPTS;
  return Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.attempts);
}

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check if account is locked
  if (isAccountLocked(username)) {
    const user = users.get(username);
    const remainingTime = Math.ceil((user.lockedUntil - Date.now()) / 1000);
    return res.status(423).json({
      error: 'Account is locked',
      remainingLockTime: `${remainingTime} seconds`,
      message: `Account locked due to too many failed login attempts. Try again in ${remainingTime} seconds.`
    });
  }

  const user = users.get(username);

  if (!user) {
    recordLoginAttempt(username, false);
    return res.status(401).json({
      error: 'Invalid credentials',
      remainingAttempts: getRemainingAttempts(username)
    });
  }

  // Verify password
  const passwordMatch = bcrypt.compareSync(password, user.password);

  if (!passwordMatch) {
    recordLoginAttempt(username, false);
    const remaining = getRemainingAttempts(username);

    if (remaining === 0) {
      return res.status(423).json({
        error: 'Account locked due to too many failed attempts',
        message: 'Your account has been locked for 15 minutes'
      });
    }

    return res.status(401).json({
      error: 'Invalid credentials',
      remainingAttempts: remaining,
      message: `Login failed. ${remaining} attempts remaining before account lockout.`
    });
  }

  // Successful login
  recordLoginAttempt(username, true);
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });

  res.json({
    message: 'Login successful',
    token,
    username
  });
});

// Reset attempts endpoint (admin function)
app.post('/admin/reset-attempts/:username', (req, res) => {
  const { username } = req.params;

  if (!users.has(username)) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users.get(username);
  user.isLocked = false;
  user.lockedUntil = null;

  loginAttempts.set(username, {
    attempts: 0,
    firstAttemptTime: null
  });

  res.json({
    message: 'Login attempts reset',
    username
  });
});

// Get user status endpoint
app.get('/user-status/:username', (req, res) => {
  const { username } = req.params;
  const user = users.get(username);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isLocked = isAccountLocked(username);
  const attempts = loginAttempts.get(username);

  res.json({
    username,
    isLocked,
    lockedUntil: isLocked ? user.lockedUntil : null,
    remainingLockTime: isLocked ? Math.ceil((user.lockedUntil - Date.now()) / 1000) : 0,
    failedAttempts: attempts?.attempts || 0,
    remainingAttempts: getRemainingAttempts(username)
  });
});

// Register endpoint for demo
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (users.has(username)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  initializeUser(username, password);
  res.status(201).json({ message: 'User registered successfully', username });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Login attempt tracking server running on port ${PORT}`);
  console.log('\nExample usage:');
  console.log('1. Register: POST /register { "username": "user1", "password": "pass123" }');
  console.log('2. Login: POST /login { "username": "user1", "password": "pass123" }');
  console.log('3. Check status: GET /user-status/user1');
  console.log('4. Reset attempts: POST /admin/reset-attempts/user1');
});

export {
  isAccountLocked,
  recordLoginAttempt,
  getRemainingAttempts,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION
};