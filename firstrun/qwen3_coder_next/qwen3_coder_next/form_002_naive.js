const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const router = express.Router();

// Mock User model - in production, this would be your actual database model
class User {
  constructor(data) {
    Object.assign(this, data);
  }

  static async findByEmail(email) {
    // In a real app, this would query the database
    // For demo purposes, we'll simulate checking if user exists
    const existingUsers = []; // This would be your actual DB query
    return existingUsers.find(user => user.email === email);
  }

  static async create(userData) {
    // In a real app, this would save to the database
    const newUser = new User({
      ...userData,
      id: crypto.randomUUID(),
      createdAt: new Date()
    });
    
    // Simulate saving to DB
    console.log('User saved:', newUser);
    return newUser;
  }
}

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ 
        error: 'All fields are required',
        missingFields: {
          firstName: !firstName,
          lastName: !lastName,
          email: !email,
          password: !password,
          confirmPassword: !confirmPassword
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (minimum 8 characters, at least one uppercase, lowercase, and number)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and contain uppercase, lowercase, and a number' 
      });
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(), // Normalize email to lowercase
      password: hashedPassword,
      role: 'user', // Default role for new users
      isEmailVerified: false,
      verificationToken: crypto.randomBytes(32).toString('hex')
    });

    // In a real application, you would send a verification email here
    // await sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(201).json({ 
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred during registration',
      details: process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
    });
  }
});

module.exports = router;