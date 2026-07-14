const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock database for demonstration purposes
const users = [];

const router = express.Router();

// Middleware to parse JSON bodies
router.use(express.json());

// Registration route
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = {
      id: crypto.randomUUID(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date()
    };

    // Save to mock database
    users.push(newUser);

    // Generate JWT token
    const secretKey = process.env.JWT_SECRET || 'default_secret_key';
    const token = jwt.sign({ userId: newUser.id }, secretKey, { expiresIn: '1h' });

    // Return success response
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;