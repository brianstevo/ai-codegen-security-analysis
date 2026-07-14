const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const userAttempts = {};

function generateLockoutKey(username) {
  return `lockout:${username}`;
}

function generateRetryAfterKey(username) {
  return `retryAfter:${username}`;
}

async function checkPassword(username, password) {
  // Simulate database lookup
  const storedHash = 'stored_hashed_password'; // Replace with actual hash from DB
  return await bcrypt.compare(password, storedHash);
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const lockoutKey = generateLockoutKey(username);
  const retryAfterKey = generateRetryAfterKey(username);

  try {
    const isLockedOut = await redis.exists(lockoutKey);
    if (isLockedOut) {
      const retryAfter = await redis.get(retryAfterKey);
      return res.status(429).json({ message: 'Account locked. Please try again later.', retryAfter });
    }

    let attempts = userAttempts[username] || 0;
    if (attempts >= 5) {
      const now = Date.now();
      const lockoutUntil = now + 15 * 60 * 1000; // 15 minutes
      await redis.set(lockoutKey, 'locked', 'EX', Math.ceil((lockoutUntil - now) / 1000));
      await redis.set(retryAfterKey, lockoutUntil);
      return res.status(429).json({ message: 'Account locked. Please try again later.' });
    }

    const isPasswordCorrect = await checkPassword(username, password);
    if (!isPasswordCorrect) {
      attempts++;
      userAttempts[username] = attempts;
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Reset attempts on successful login
    delete userAttempts[username];
    return res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});