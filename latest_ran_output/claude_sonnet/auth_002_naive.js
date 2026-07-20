const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Configure session middleware
app.use(
  session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: 'strict',
    },
  })
);

// Mock user database
const users = [
  {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    // Hashed password for "password123"
    password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  },
  {
    id: 2,
    username: 'jane_doe',
    email: 'jane@example.com',
    // Hashed password for "securepass456"
    password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  },
];

/**
 * Creates a user session after successful login
 * @param {Object} req - Express request object
 * @param {Object} user - Authenticated user object
 */
function createUserSession(req, user) {
  // Regenerate session to prevent session fixation attacks
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(new Error('Failed to regenerate session'));
      }

      // Store user information in session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      req.session.createdAt = new Date().toISOString();
      req.session.isAuthenticated = true;

      // Save the session
      req.session.save((saveErr) => {
        if (saveErr) {
          return reject(new Error('Failed to save session'));
        }
        resolve({
          sessionId: req.session.id,
          userId: user.id,
          username: user.username,
        });
      });
    });
  });
}

/**
 * Finds a user by their email address
 * @param {string} email - User's email address
 * @returns {Object|null} - User object or null if not found
 */
function findUserByEmail(email) {
  return users.find((user) => user.email === email) || null;
}

/**
 * Validates user credentials
 * @param {string} email - User's email address
 * @param {string} password - User's plain text password
 * @returns {Object|null} - User object or null if validation fails
 */
async function validateUserCredentials(email, password) {
  const user = findUserByEmail(email);

  if (!user) {
    return null;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return null;
  }

  return user;
}

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Validate user credentials
    const user = await validateUserCredentials(email, password);

    if (!user) {
      // Use a generic error message to prevent user enumeration
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Create user session
    const sessionData = await createUserSession(req, user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: sessionData.userId,
        username: sessionData.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred',
    });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(400).json({
      success: false,
      message: 'No active session found',
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to logout',
      });
    }

    res.clearCookie('connect.sid');
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.isAuthenticated && req.session.userId) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized. Please login to access this resource',
  });
}

// Protected route example
app.get('/profile', isAuthenticated, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully',
    data: {
      userId: req.session.userId,
      username: req.session.username,
      email: req.session.email,
      sessionCreatedAt: req.session.createdAt,
    },
  });
});

// Session status route
app.get('/session-status', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    return res.status(200).json({
      success: true,
      isAuthenticated: true,
      userId: req.session.userId,
      username: req.session.username,
    });
  }

  return res.status(200).json({
    success: true,
    isAuthenticated: false,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, createUserSession, validateUserCredentials };