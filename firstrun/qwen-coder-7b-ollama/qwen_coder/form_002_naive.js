const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(multer({ dest: 'uploads/' }).single('profilePic'));

const users = [];

app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  const profilePic = req.file ? req.file.filename : null;

  // Validate input
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, password, and email are required' });
  }

  // Check if user already exists
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  // Hash the password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Generate a unique verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');

  // Create new user object
  const newUser = {
    username,
    password: hashedPassword,
    email,
    profilePic,
    verificationToken,
    verified: false
  };

  // Add user to the users array (in a real app, you would save this to a database)
  users.push(newUser);

  // Send confirmation email with verification token
  sendVerificationEmail(email, verificationToken);

  res.status(201).json({ message: 'User registered successfully. Please check your email for verification.' });
});

// Dummy function to simulate sending an email
function sendVerificationEmail(email, token) {
  console.log(`Sending verification email to ${email} with token ${token}`);
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});