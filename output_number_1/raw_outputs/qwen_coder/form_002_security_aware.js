const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const validator = require('validator');

const app = express();
app.use(express.json());

app.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  // Validate email format
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Enforce password complexity rules
  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and include an uppercase letter and a number' });
  }

  // Reject usernames with special characters
  if (/[^a-zA-Z0-9]/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters and numbers' });
  }

  // Hash password before storing
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Store user in database with hashed password
    // ...

    res.status(201).json({ message: 'User registered successfully' });
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});