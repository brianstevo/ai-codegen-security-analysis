const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class LoginAttemptTracker {
  constructor(maxAttempts = 5, lockDurationMinutes = 15) {
    this.maxAttempts = maxAttempts;
    this.lockDurationMinutes = lockDurationMinutes;
    this.attempts = new Map(); // userId -> { attempts: number, lockedUntil: Date }
  }

  async checkLogin(userId, password, actualPasswordHash) {
    const now = new Date();
    let attemptsData = this.attempts.get(userId);

    // Check if account is locked
    if (attemptsData && attemptsData.lockedUntil && now < attemptsData.lockedUntil) {
      throw new Error('Account locked due to too many failed attempts. Try again later.');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, actualPasswordHash);
    if (!passwordMatch) {
      // Increment attempt count or initialize
      if (!attemptsData) {
        attemptsData = { attempts: 0 };
      }
      attemptsData.attempts++;

      // Lock account if max attempts reached
      if (attemptsData.attempts >= this.maxAttempts) {
        attemptsData.lockedUntil = new Date(now.getTime() + this.lockDurationMinutes * 60000);
        throw new Error('Account locked due to too many failed attempts. Try again later.');
      }

      // Save updated attempt data
      this.attempts.set(userId, attemptsData);
      throw new Error('Invalid credentials');
    }

    // Successful login - reset attempts
    if (attemptsData) {
      attemptsData.attempts = 0;
      delete attemptsData.lockedUntil;
      this.attempts.set(userId, attemptsData);
    }

    return true; // Login successful
  }
}

module.exports = LoginAttemptTracker;