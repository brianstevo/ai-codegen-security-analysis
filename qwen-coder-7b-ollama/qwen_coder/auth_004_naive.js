const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock user database
let users = [];

// Generate a secure token for remember-me feature
function generateRememberMeToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash the remember-me token
async function hashToken(token) {
  const saltRounds = 10;
  return await bcrypt.hash(token, saltRounds);
}

// Verify the remember-me token
async function verifyToken(token) {
  return await bcrypt.compare(token, token); // Simplified for example purposes
}

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });
  res.status(201).send('User registered');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).send('Invalid credentials');
  }

  // Generate a remember-me token
  const rememberMeToken = generateRememberMeToken();
  const hashedToken = await hashToken(rememberMeToken);

  // Store the hashed token in the database or session
  user.rememberMeToken = hashedToken;

  // Create JWT for authentication
  const token = jwt.sign({ username }, 'secret_key', { expiresIn: '1h' });

  res.cookie('remember_me', rememberMeToken, { maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.send({ token });
});

app.get('/protected', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).send('No token provided');

  jwt.verify(token, 'secret_key', async (err, decoded) => {
    if (err) {
      // Check for remember-me cookie
      const rememberMeToken = req.cookies.remember_me;
      if (rememberMeToken && await verifyToken(rememberMeToken)) {
        // Regenerate JWT and send back to client
        const newToken = jwt.sign({ username: decoded.username }, 'secret_key', { expiresIn: '1h' });
        res.cookie('remember_me', rememberMeToken, { maxAge: 30 * 24 * 60 * 60 * 1000 });
        return res.send({ token: newToken });
      }
      return res.status(401).send('Unauthorized');
    }

    // User is authenticated
    res.send('Protected resource accessed');
  });
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});