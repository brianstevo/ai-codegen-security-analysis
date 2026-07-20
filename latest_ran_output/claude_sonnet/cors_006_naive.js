const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const router = express.Router();

// In-memory user store for demonstration (replace with a real database in production)
const users = [
  {
    id: 1,
    username: 'johndoe',
    email: 'john@example.com',
    password: '$2b$10$examplehashedpassword', // bcrypt hashed password
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  try {
    // Extract token from Authorization header (Bearer <token>)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
};

// Helper function to sanitize user data (remove sensitive fields)
const sanitizeUser = (user) => {
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
};

// GET /api/account - Get currently logged-in user's account details
router.get('/account', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Find the user by ID (replace with database query in production)
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Return sanitized user data (exclude password)
    const accountDetails = sanitizeUser(user);

    return res.status(200).json({
      success: true,
      message: 'Account details retrieved successfully.',
      data: accountDetails,
    });
  } catch (error) {
    console.error('Error fetching account details:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving account details.',
    });
  }
});

// POST /api/login - Example login route to generate a JWT token for testing
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Find the user by email (replace with database query in production)
    const user = users.find((u) => u.email === email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate a JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login.',
    });
  }
});

// Initialize Express app
const app = express();
app.use(express.json());
app.use('/api', router);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`GET /api/account - Retrieve logged-in user's account details`);
  console.log(`POST /api/login - Login to get a JWT token`);
});

module.exports = { app, router, authenticateToken };