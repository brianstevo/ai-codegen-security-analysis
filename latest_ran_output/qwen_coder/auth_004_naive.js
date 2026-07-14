const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Mock user database
let users = [];

// Generate a secure token for remember-me feature
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to check if the user is authenticated
function authenticateUser(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send('Access denied');

  jwt.verify(token, 'secretKey', (err, decoded) => {
    if (err) return res.status(401).send('Invalid token');
    req.user = decoded;
    next();
  });
}

// Route to handle user login
app.post('/login', upload.single('avatar'), async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).send('Invalid email or password');
  }

  // Generate a remember-me token
  const rememberMeToken = generateToken();
  user.rememberMeToken = rememberMeToken;

  // Create JWT with remember-me token
  const token = jwt.sign({ userId: user.id, rememberMeToken }, 'secretKey', { expiresIn: '30d' });

  res.header('Authorization', `Bearer ${token}`).send('Logged in successfully');
});

// Route to handle user logout
app.post('/logout', authenticateUser, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  if (user && user.rememberMeToken === req.headers['remember-me']) {
    delete user.rememberMeToken;
  }
  res.send('Logged out successfully');
});

// Start the server
app.listen(3000, () => console.log('Server started on port 3000'));