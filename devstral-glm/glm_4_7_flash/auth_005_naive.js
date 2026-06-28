const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Simulated database using an in-memory Map
const userDatabase = new Map();

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const JWT_SECRET = 'your_jwt_secret_key';

/**
 * Authenticates a user and handles login attempt tracking.
 * @param {string} username - The username of the user.
 * @param {string} password - The plain text password provided by the user.
 * @returns {Promise<Object>} - An object containing success status, message, and optionally a JWT token.
 */
async function authenticateUser(username, password) {
  // 1. Retrieve user from simulated database
  const user = userDatabase.get(username);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  // 2. Check if account is currently locked
  if (user.isLocked) {
    if (Date.now() < user.lockedUntil) {
      const timeLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return { success: false, message: `Account locked. Try again in ${timeLeft} minutes.` };
    } else {
      // Lockout period expired, reset attempts
      user.failedAttempts = 0;
      user.isLocked = false;
      user.lockedUntil = null;
    }
  }

  // 3. Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (isPasswordValid) {
    // Successful login
    user.failedAttempts = 0;
    user.isLocked = false;
    user.lockedUntil = null;

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    return { success: true, message: 'Login successful', token };
  } else {
    // Failed login
    user.failedAttempts += 1;

    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      // Lock the account
      user.isLocked = true;
      user.lockedUntil = Date.now() + LOCK_TIME_MS;
      return { success: false, message: 'Too many failed attempts. Account locked.' };
    }

    return { success: false, message: 'Invalid credentials' };
  }
}

// Example initialization (for demonstration purposes)
// const hashedPassword = await bcrypt.hash('password123', 10);
// userDatabase.set('admin', { id: 1, username: 'admin', passwordHash: hashedPassword, failedAttempts: 0, isLocked: false, lockedUntil: null });