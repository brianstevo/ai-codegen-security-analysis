const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();

// Assuming you have a User model defined elsewhere
// const User = require('../models/User');

// Mock User model for demonstration purposes
class User {
  constructor(data) {
    Object.assign(this, data);
  }
  
  static async findOne(query) {
    // In a real app, this would query the database
    return null; // Assuming user doesn't exist for registration flow
  }
  
  async save() {
    // In a real app, this would save to the database
    this._id = crypto.randomBytes(12).toString('hex');
    return this;
  }
}

// Register route
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }
    
    // Validate password length (minimum 8 characters recommended)
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }
    
    // Confirm passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Passwords do not match' 
      });
    }
    
    // Check if username already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        error: 'Username or email already exists' 
      });
    }
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create new user instance
    const newUser = new User({
      username,
      email: email.toLowerCase(), // Normalize email to lowercase
      password: hashedPassword,
      createdAt: new Date()
    });
    
    // Save the user to database
    await newUser.save();
    
    // Send success response (don't send back the password hash)
    res.status(201).json({ 
      message: 'User registered successfully',
      userId: newUser._id,
      username: newUser.username
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Server error during registration' 
    });
  }
});

module.exports = router;