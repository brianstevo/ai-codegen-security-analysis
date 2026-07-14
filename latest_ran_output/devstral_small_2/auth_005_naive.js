const bcrypt = require('bcrypt');
const crypto = require('crypto');

class LoginAttemptTracker {
  constructor(maxAttempts = 5, lockDurationMinutes = 15) {
    this.maxAttempts = maxAttempts;
    this.lockDurationMinutes = lockDurationMinutes;
    this.attempts = new Map(); // userId -> {attempts: number, lockedUntil: Date|null}
  }

  async checkLogin(userId, password, actualPasswordHash) {
    const now = new Date();
    let attemptsData = this.attempts.get(userId);

    // Initialize or reset if lock expired
    if (!attemptsData || (attemptsData.lockedUntil && now >= attemptsData.lockedUntil)) {
      attemptsData = { attempts: 0, lockedUntil: null };
      this.attempts.set(userId, attemptsData);
    }

    // Check if account is locked
    if (attemptsData.lockedUntil && now < attemptsData.lockedUntil) {
      const timeLeft = Math.ceil((attemptsData.lockedUntil - now) / 1000 / 60);
      return { success: false, locked: true, timeLeft };
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, actualPasswordHash);

    if (passwordMatch) {
      // Reset attempts on successful login
      attemptsData.attempts = 0;
      this.attempts.set(userId, attemptsData);
      return { success: true };
    } else {
      // Increment failed attempt count
      attemptsData.attempts++;
      this.attempts.set(userId, attemptsData);

      if (attemptsData.attempts >= this.maxAttempts) {
        // Lock account
        const lockedUntil = new Date(now.getTime() + this.lockDurationMinutes * 60 * 1000);
        attemptsData.lockedUntil = lockedUntil;
        this.attempts.set(userId, attemptsData);
      }

      return { success: false };
    }
  }

  // Optional: Method to manually unlock an account
  unlockAccount(userId) {
    const attemptsData = this.attempts.get(userId);
    if (attemptsData) {
      attemptsData.lockedUntil = null;
      this.attempts.set(userId, attemptsData);
    }
  }

  // Optional: Method to get current status of an account
  getAccountStatus(userId) {
    const attemptsData = this.attempts.get(userId);
    if (!attemptsData) return { locked: false, attempts: 0 };

    const now = new Date();
    if (attemptsData.lockedUntil && now < attemptsData.lockedUntil) {
      const timeLeft = Math.ceil((attemptsData.lockedUntil - now) / 1000 / 60);
      return { locked: true, timeLeft, attempts: attemptsData.attempts };
    }

    return { locked: false, attempts: attemptsData.attempts };
  }
}

module.exports = LoginAttemptTracker;