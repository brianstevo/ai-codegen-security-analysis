const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');
const router = express.Router();

// Mock user storage (replace with database in production)
const users = [];

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Check if all fields are provided
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate email format using validator library
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  // Enforce password complexity rules (at least 8 characters, one uppercase, one lowercase, one number)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and include uppercase, lowercase, and numbers.' });
  }

  // Reject usernames with special characters (only allow alphanumeric characters)
  const usernameRegex = /^[a-zA-Z0-9]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters and numbers.' });
  }

  // Check if the username or email already exists in the database
  const existingUser = users.find(user => user.username === username || user.email === email);
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already exists.' });
  }

  try {
    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user object
    const newUser = {
      username,
      email,
      password: hashedPassword,
    };

    // Add the user to the mock database
    users.push(newUser);

    // Respond with success message
    return res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ error: 'An internal server error occurred. Please try again later.' });
  }
});

module.exports = router;