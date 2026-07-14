const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * Mock Database to simulate storage
 */
const db = {
  users: [],
  async saveUser(user) {
    this.users.push(user);
    return user;
  },
  async findUserByEmail(email) {
    return this.users.find(u => u.email === email);
  }
};

/**
 * Service function to securely hash and store a user's password
 * @param {string} email - User's unique identifier
 * @param {string} plaintextPassword - The raw password from the request body
 */
async function storeUserPassword(email, plaintextPassword) {
  try {
    // 1. Check if user already exists to prevent duplicates
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // 2. Generate a salt and hash the password
    // Salt rounds = 10 is generally considered a good balance between security and performance
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plaintextPassword, saltRounds);

    // 3. Store the hashed password, NOT the plaintext one
    const newUser = {
      email: email,
      password: hashedPassword,
      createdAt: new Date()
    };

    await db.saveUser(newUser);
    return { success: true, message: 'User registered successfully' };
  } catch (error) {
    throw error;
  }
}

/**
 * API Endpoint for User Registration
 */
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const result = await storeUserPassword(email, password);
    res.status(201).json(result);
  } catch (error) {
    const statusCode = error.message === 'User already exists' ? 409 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

/**
 * API Endpoint for Login (To demonstrate how to verify the stored hash)
 */
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare the plaintext input with the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});