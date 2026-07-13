const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Simulated user database
const users = [
  {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    // Pre-hashed password: "password123"
    password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  },
  {
    id: 2,
    username: 'jane_doe',
    email: 'jane@example.com',
    // Pre-hashed password: "securepass456"
    password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  },
];

/**
 * Find user by username or email
 * @param {string} identifier - Username or email
 * @returns {Object|undefined} User object or undefined
 */
const findUser = (identifier) => {
  return users.find(
    (user) => user.username === identifier || user.email === identifier
  );
};

/**
 * Creates a user session after successful login
 * @param {Object} req - Express request object
 * @param {Object} user - Authenticated user object
 * @returns {Promise<void>}
 */
const createUserSession = (req, user) => {
  return new Promise((resolve, reject) => {
    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        return reject(new Error('Failed to regenerate session'));
      }

      // Store user information in session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      req.session.isAuthenticated = true;
      req.session.loginTime = new Date().toISOString();
      req.session.lastActivity = new Date().toISOString();

      // Save the session
      req.session.save((saveErr) => {
        if (saveErr) {
          return reject(new Error('Failed to save session'));
        }
        resolve();
      });
    });
  });
};

/**
 * Middleware to check if user is authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAuthenticated && req.session.userId) {
    // Update last activity timestamp
    req.session.lastActivity = new Date().toISOString();
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized. Please log in.',
  });
};

/**
 * Login route - Authenticates user and creates session
 */
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Validate input
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required.',
      });
    }

    // Find user by username or email
    const user = findUser(identifier);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // Compare provided password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // Create user session
    await createUserSession(req, user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      sessionId: req.session.id,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login.',
    });
  }
});

/**
 * Logout route - Destroys user session
 */
app.post('/api/logout', isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during logout.',
      });
    }

    res.clearCookie('connect.sid');
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  });
});

/**
 * Protected route - Returns session information
 */
app.get('/api/session', isAuthenticated, (req, res) => {
  return res.status(200).json({
    success: true,
    session: {
      userId: req.session.userId,
      username: req.session.username,
      email: req.session.email,
      loginTime: req.session.loginTime,
      lastActivity: req.session.lastActivity,
    },
  });
});

/**
 * Protected route - Example of accessing user ID from session
 */
app.get('/api/profile', isAuthenticated, (req, res) => {
  const userId = req.session.userId;

  // Find user by ID stored in session
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  return res.status(200).json({
    success: true,
    profile: {
      id: user.id,
      username: user.username,
      email: user.email,
    },
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, createUserSession, isAuthenticated };