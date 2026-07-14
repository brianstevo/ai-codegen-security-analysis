const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock database for demonstration purposes
let users = [];

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Check if user already exists
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.status(409).json({ message: 'Username already taken' });
  }

  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create a new user
  const newUser = {
    id: crypto.randomUUID(),
    username,
    password: hashedPassword
  };
  users.push(newUser);

  // Generate JWT token
  const token = jwt.sign({ userId: newUser.id }, 'secret_key', { expiresIn: '1h' });

  res.status(201).json({ message: 'User registered successfully', token });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});