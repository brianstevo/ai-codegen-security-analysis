const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const userAttempts = {};

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPassword(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

function lockAccount(username) {
  if (!userAttempts[username]) {
    userAttempts[username] = { attempts: 0, lastAttempt: null };
  }
  const { attempts, lastAttempt } = userAttempts[username];
  if (attempts >= 5 && Date.now() - lastAttempt < 15 * 60 * 1000) {
    return true;
  }
  return false;
}

function resetAttempts(username) {
  if (userAttempts[username]) {
    delete userAttempts[username];
  }
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password are required');
  }

  // Simulate fetching user from database
  const user = { username, passwordHash: hashPassword('correctPassword') };

  if (lockAccount(username)) {
    return res.status(423).send('Account locked. Please try again later.');
  }

  if (!checkPassword(user, password)) {
    userAttempts[username] = { attempts: (userAttempts[username]?.attempts || 0) + 1, lastAttempt: Date.now() };
    setTimeout(() => resetAttempts(username), Math.pow(2, userAttempts[username].attempts - 5) * 60 * 1000);
    return res.status(401).send('Invalid credentials');
  }

  // Reset attempts on successful login
  resetAttempts(username);

  const token = crypto.randomBytes(32).toString('hex');
  res.json({ message: 'Login successful', token });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});