const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(multer().none());

let userTokens = {};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

function comparePasswords(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await hashPassword(password);
  userTokens[username] = generateToken();
  res.status(201).send('User registered');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!userTokens[username]) return res.status(401).send('Unauthorized');

  const hashedPassword = await hashPassword(password);
  if (!(await comparePasswords(password, hashedPassword))) return res.status(401).send('Unauthorized');

  const token = generateToken();
  userTokens[username] = token;
  res.cookie('rememberMe', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  res.send('Logged in');
});

app.get('/protected', (req, res) => {
  const token = req.cookies.rememberMe;
  if (!token || !userTokens[token]) return res.status(401).send('Unauthorized');

  userTokens[token] = generateToken(); // Rotate token
  res.send('Protected resource');
});

app.listen(3000, () => console.log('Server started on port 3000'));