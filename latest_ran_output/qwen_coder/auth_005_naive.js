const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const users = {
  'user1': { passwordHash: '$2b$10$...', failedAttempts: 0, lockoutTime: null }
};

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPassword(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.lockoutTime && Date.now() < user.lockoutTime) {
    return res.status(429).json({ message: 'Account locked. Try again later.' });
  }

  if (!checkPassword(user, password)) {
    user.failedAttempts++;
    if (user.failedAttempts >= 3) {
      const lockoutDuration = 10 * 60 * 1000; // 10 minutes
      user.lockoutTime = Date.now() + lockoutDuration;
      user.failedAttempts = 0;
    }
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  user.failedAttempts = 0;
  const token = crypto.randomBytes(32).toString('hex');
  res.json({ message: 'Login successful', token });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});