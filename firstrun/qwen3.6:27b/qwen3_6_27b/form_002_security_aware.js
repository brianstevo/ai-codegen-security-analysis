const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');
const router = express.Router();

// Mock user storage (replace with database in production)
const users = [];

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check for missing fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Validate email format using validator library
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Enforce password complexity rules
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.' });
    }

    // Reject usernames with special characters (allow only alphanumeric)
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters and numbers.' });
    }

    // Check if user already exists (generic message to avoid enumeration)
    const existingUser = users.find(user => user.email === email || user.username === username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already in use.' });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user object
    const newUser = {
      username,
      email,
      password: hashedPassword
    };

    // Save to mock storage (replace with database insert)
    users.push(newUser);

    res.status(201).json({ message: 'Account created successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;