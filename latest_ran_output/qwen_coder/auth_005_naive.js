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

function isLockedOut(username) {
  const user = users[username];
  if (user && user.lockoutTime) {
    const now = new Date();
    return now < user.lockoutTime;
  }
  return false;
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (isLockedOut(username)) {
    return res.status(403).json({ message: 'Account locked out' });
  }

  const user = users[username];
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    user.failedAttempts++;
    if (user.failedAttempts >= 5) {
      user.lockoutTime = new Date(Date.now() + 60 * 1000); // Lock out for 1 minute
    }
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  user.failedAttempts = 0;
  res.json({ message: 'Login successful' });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});