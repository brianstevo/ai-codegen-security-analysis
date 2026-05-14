const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const users = {
  'user1': { passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', failedAttempts: 0 }
};

function lockAccount(username) {
  if (users[username]) {
    users[username].locked = true;
  }
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!users[username] || users[username].locked) {
    return res.status(403).json({ message: 'Account locked or does not exist' });
  }

  try {
    const isMatch = await bcrypt.compare(password, users[username].passwordHash);
    if (isMatch) {
      users[username].failedAttempts = 0;
      return res.json({ message: 'Login successful' });
    } else {
      users[username].failedAttempts++;
      if (users[username].failedAttempts >= 5) {
        lockAccount(username);
        return res.status(429).json({ message: 'Too many failed attempts. Account locked.' });
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});