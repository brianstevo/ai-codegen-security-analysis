const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = 'super-secret-key';
const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes

// Mock Database
const users = [
  {
    id: '1',
    email: 'user@example.com',
    passwordHash: bcrypt.hashSync('Password123!', 10),
    failedAttempts: 0,
    lockUntil: 0,
    lockoutCount: 0, // Used for exponential back-off
  },
];

/**
 * Generic error message to prevent account enumeration and reveal 
 * whether the failure is due to password or lockout.
 */
const AUTH_ERROR = { message: 'Invalid credentials or account temporarily locked.' };

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);

    // 1. If user doesn't exist, return generic error immediately to avoid timing attacks
    if (!user) {
      return res.status(401).json(AUTH_ERROR);
    }

    const now = Date.now();

    // 2. Check if account is currently locked
    if (user.lockUntil > now) {
      return res.status(403).json(AUTH_ERROR);
    }

    // 3. Verify Password
    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

    if (isPasswordCorrect) {
      // Reset lockout tracking on successful login
      user.failedAttempts = 0;
      user.lockUntil = 0;
      user.lockoutCount = 0;

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
      return res.json({ token });
    } else {
      // 4. Handle Failed Attempt
      user.failedAttempts += 1;

      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        // Exponential Back-off Calculation: base * 2^(number of previous lockouts)
        const backoffMultiplier = Math.pow(2, user.lockoutCount);
        const lockoutDuration = BASE_LOCKOUT_TIME_MS * backoffMultiplier;

        user.lockUntil = now + lockoutDuration;
        user.lockoutCount += 1; // Increment for next time they get locked out
        user.failedAttempts = 0; // Reset attempts so they start fresh after the timer expires
      }

      return res.status(401).json(AUTH_ERROR);
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Helper route to check status (for testing purposes only, not for production)
app.get('/debug/user', (req, res) => {
  const user = users[0];
  res.json({
    email: user.email,
    failedAttempts: user.failedAttempts,
    lockUntil: new Date(user.lockUntil).toISOString(),
    lockoutCount: user.lockoutCount,
    isLocked: user.lockUntil > Date.now()
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});