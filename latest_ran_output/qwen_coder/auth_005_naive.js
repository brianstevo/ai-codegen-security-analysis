const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const users = {
  'user1': { passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', failedAttempts: 0, lockoutTime: null }
};

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!users[username]) {
    return res.status(404).json({ message: 'User not found' });
  }

  try {
    const isPasswordValid = await bcrypt.compare(password, users[username].passwordHash);
    if (isPasswordValid) {
      users[username].failedAttempts = 0;
      users[username].lockoutTime = null;
      return res.status(200).json({ message: 'Login successful' });
    } else {
      users[username].failedAttempts++;
      if (users[username].failedAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_DURATION;
        users[username].lockoutTime = lockoutTime;
        return res.status(401).json({ message: 'Too many failed attempts. Account locked for 1 hour' });
      } else {
        return res.status(401).json({ message: 'Invalid password' });
      }
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});