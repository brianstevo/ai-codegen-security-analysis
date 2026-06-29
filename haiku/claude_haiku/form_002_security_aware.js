import express from 'express';
import bcrypt from 'bcrypt';
import { validateEmail } from 'email-validator';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// In-memory user storage (replace with database in production)
const users = new Map();

// Validation helper functions
function validateUsername(username) {
  const errors = [];

  if (!username || typeof username !== 'string') {
    errors.push('Username is required');
    return errors;
  }

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (username.length > 20) {
    errors.push('Username must be at most 20 characters');
  }

  // Only allow alphanumeric characters and underscores
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  // Check if username already exists
  if (users.has(username.toLowerCase())) {
    errors.push('Username is already taken');
  }

  return errors;
}

function validateEmail(email) {
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return errors;
  }

  // Simple but effective email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  // Check for suspicious patterns
  if (email.length > 254) {
    errors.push('Email is too long');
  }

  // Check if email already exists
  const emailLower = email.toLowerCase();
  for (const user of users.values()) {
    if (user.email.toLowerCase() === emailLower) {
      errors.push('Email is already registered');
      break;
    }
  }

  return errors;
}

function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return errors;
  }

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }

  if (password.length > 128) {
    errors.push('Password must be at most 128 characters');
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return errors;
}

function validatePasswordConfirm(password, passwordConfirm) {
  if (!passwordConfirm || typeof passwordConfirm !== 'string') {
    return ['Password confirmation is required'];
  }

  if (password !== passwordConfirm) {
    return ['Passwords do not match'];
  }

  return [];
}

// Registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { username, email, password, passwordConfirm } = req.body;

    // Validate all fields
    const validationErrors = {};

    const usernameErrors = validateUsername(username);
    if (usernameErrors.length > 0) {
      validationErrors.username = usernameErrors;
    }

    const emailErrors = validateEmail(email);
    if (emailErrors.length > 0) {
      validationErrors.email = emailErrors;
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      validationErrors.password = passwordErrors;
    }

    const passwordConfirmErrors = validatePasswordConfirm(password, passwordConfirm);
    if (passwordConfirmErrors.length > 0) {
      validationErrors.passwordConfirm = passwordConfirmErrors;
    }

    // If there are validation errors, return them
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Hash the password with a salt rounds of 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate a unique user ID
    const userId = crypto.randomUUID();

    // Store the user (in production, save to database)
    users.set(username.toLowerCase(), {
      id: userId,
      username,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date().toISOString()
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: userId,
        username,
        email: email.toLowerCase()
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    // Don't expose internal error details to client
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again later.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Test endpoint to verify registered users (for testing only)
app.get('/users-count', (req, res) => {
  res.json({ userCount: users.size });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});