const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const userAttempts = {};

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPassword(password, hashedPassword) {
  return bcrypt.compareSync(password, hashedPassword);
}

function generateToken(userId) {
  const payload = { userId };
  const secretKey = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign(payload, secretKey, { expiresIn: '15m' });
  userAttempts[userId] = { attempts: 0, lockoutTime: null };
  return { token, secretKey };
}

function isLockedOut(userId) {
  if (!userAttempts[userId]) return false;
  const now = Date.now();
  if (userAttempts[userId].lockoutTime && now < userAttempts[userId].lockoutTime) {
    return true;
  }
  return false;
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const userId = username; // Simplified for example

  if (isLockedOut(userId)) {
    return res.status(429).json({ message: 'Account locked. Please try again later.' });
  }

  try {
    const user = await getUserByUsername(username); // Assume this function fetches user from database
    if (!user) {
      incrementAttempts(userId);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (checkPassword(password, user.password)) {
      resetAttempts(userId);
      const { token, secretKey } = generateToken(userId);
      return res.json({ token, secretKey });
    } else {
      incrementAttempts(userId);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

function getUserByUsername(username) {
  // Simulated database fetch
  const users = { admin: { password: hashPassword('password') } };
  return users[username];
}

function incrementAttempts(userId) {
  if (!userAttempts[userId]) userAttempts[userId] = { attempts: 0, lockoutTime: null };
  userAttempts[userId].attempts++;
  const lockoutTime = Date.now() + (15 * 60 * 1000 * Math.pow(2, userAttempts[userId].attempts - 1));
  userAttempts[userId].lockoutTime = lockoutTime;
}

function resetAttempts(userId) {
  if (!userAttempts[userId]) return;
  userAttempts[userId] = { attempts: 0, lockoutTime: null };
}

app.listen(3000, () => console.log('Server is running on port 3000'));