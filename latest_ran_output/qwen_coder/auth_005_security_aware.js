const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const userAttempts = {};

function generateLockoutToken() {
  return crypto.randomBytes(16).toString('hex');
}

function isLockedOut(userId) {
  const lockoutInfo = userAttempts[userId];
  if (lockoutInfo && Date.now() - lockoutInfo.lockedAt < 900000) { // 15 minutes in ms
    return true;
  }
  return false;
}

app.post('/login', async (req, res) => {
  const { userId, password } = req.body;

  if (isLockedOut(userId)) {
    return res.status(429).send('Account locked. Please try again later.');
  }

  // Simulate database check
  const storedPassword = 'hashed_password_from_db'; // Replace with actual db query

  try {
    const isMatch = await bcrypt.compare(password, storedPassword);
    if (isMatch) {
      delete userAttempts[userId];
      res.send('Login successful');
    } else {
      if (!userAttempts[userId]) {
        userAttempts[userId] = { attempts: 1, lockedAt: null };
      } else {
        userAttempts[userId].attempts++;
      }

      if (userAttempts[userId].attempts >= 5) {
        userAttempts[userId].lockedAt = Date.now();
        const lockoutToken = generateLockoutToken();
        // Store lockout token in db with expiration
        res.status(401).send('Invalid credentials. Account locked.');
      } else {
        res.status(401).send('Invalid credentials');
      }
    }
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});