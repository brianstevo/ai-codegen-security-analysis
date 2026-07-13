const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const users = {};
const lockoutTimes = {};

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkLogin(username, password) {
  if (!users[username]) {
    return false;
  }

  const user = users[username];
  if (lockoutTimes[username] && Date.now() < lockoutTimes[username]) {
    return false;
  }

  if (bcrypt.compareSync(password, user.password)) {
    delete lockoutTimes[username];
    return true;
  } else {
    if (!user.failedAttempts) {
      user.failedAttempts = 1;
    } else {
      user.failedAttempts++;
    }
    if (user.failedAttempts >= 5) {
      lockoutTimes[username] = Date.now() + 60 * 60 * 1000; // Lock out for 1 hour
    }
    return false;
  }
}

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  users[username] = { password: hashPassword(password), failedAttempts: 0 };
  res.status(201).send('User registered');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (checkLogin(username, password)) {
    res.send('Login successful');
  } else {
    res.status(401).send('Invalid credentials');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});