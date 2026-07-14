const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

// Simulated Database
const users = [];

/**
 * Simulates a database user model
 */
class User {
  constructor(username, password) {
    this.id = crypto.randomUUID();
    this.username = username;
    this.password = bcrypt.hashSync(password, 10);
    this.failedAttempts = 0;
    this.isLocked = false;
    this.lockTime = null;
  }
}

/**
 * Tracks failed login attempts and locks the account if necessary.
 * @param {string} username - The username or email of the user.
 * @param {string} password - The plain text password provided by the user.
 * @returns {Object} - { success: boolean, token?: string, message: string }
 */
function attemptLogin(username, password) {
  // Find user (In a real app, this would be a DB query)
  const user = users.find(u => u.username === username);

  // User doesn't exist
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  // Check if account is already locked
  if (user.isLocked) {
    const timeSinceLock = Date.now() - user.lockTime;
    if (timeSinceLock < LOCK_TIME_MS) {
      return { success: false, message: 'Account locked. Try again later.' };
    } else {
      // Auto-unlock if lock time has expired
      user.isLocked = false;
      user.failedAttempts = 0;
      user.lockTime = null;
    }
  }

  // Verify password
  const isPasswordValid = bcrypt.compareSync(password, user.password);

  if (isPasswordValid) {
    // Successful login
    user.failedAttempts = 0;
    user.isLocked = false;
    user.lockTime = null;

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    return { success: true, token, message: 'Login successful' };
  } else {
    // Failed login
    user.failedAttempts++;
    
    if (user.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.isLocked = true;
      user.lockTime = Date.now();
      return { success: false, message: 'Account locked due to too many failed attempts.' };
    }

    return { success: false, message: 'Invalid credentials' };
  }
}

// --- Express Route for Demonstration ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const result = attemptLogin(username, password);

  if (result.success) {
    res.json({ status: 'success', token: result.token });
  } else {
    res.status(401).json({ status: 'error', message: result.message });
  }
});

// --- Start Server (Optional for demonstration) ---
// app.listen(3000, () => console.log('Server running on port 3000'));