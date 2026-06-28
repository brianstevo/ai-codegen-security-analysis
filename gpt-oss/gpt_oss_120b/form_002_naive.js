// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ----- DB Setup -----
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on('error', err => console.error('MongoDB connection error:', err));

// ----- User Model -----
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, minlength: 3, maxlength: 30 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'users' }
);
const User = mongoose.model('User', userSchema);

// ----- Express App -----
const app = express();
app.use(express.json()); // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse URL‑encoded bodies

// ----- Registration Route -----
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user document
    const newUser = new User({
      username,
      email: email.toLowerCase(),
      passwordHash,
    });

    await newUser.save();

    // Generate JWT (optional but common)
    const tokenPayload = { id: newUser._id, email: newUser.email };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'supersecretkey', {
      expiresIn: '7d',
    });

    // Respond with user info (excluding password) and token
    res.status(201).json({
      message: 'Registration successful.',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
      token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----- Start Server -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});