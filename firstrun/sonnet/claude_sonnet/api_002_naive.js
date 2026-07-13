const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Mock database (replace with actual DB queries in production)
const users = {
  '1': {
    id: '1',
    username: 'john_doe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-03-20T14:45:00Z',
    isActive: true,
    profilePicture: 'https://example.com/avatars/john.jpg',
    phoneNumber: '+1-555-0100',
  },
  '2': {
    id: '2',
    username: 'jane_smith',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'admin',
    createdAt: '2024-02-01T08:00:00Z',
    updatedAt: '2024-03-18T09:15:00Z',
    isActive: true,
    profilePicture: 'https://example.com/avatars/jane.jpg',
    phoneNumber: '+1-555-0200',
  },
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

// Middleware to validate user ID parameter
const validateUserId = (req, res, next) => {
  const { userId } = req.params;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID format',
    });
  }

  // Basic sanitization: ensure userId only contains alphanumeric characters
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return res.status(400).json({
      success: false,
      message: 'User ID contains invalid characters',
    });
  }

  next();
};

// Authorization middleware: ensures users can only access their own data (unless admin)
const authorizeAccess = (req, res, next) => {
  const { userId } = req.params;
  const requestingUser = req.user;

  if (requestingUser.role !== 'admin' && requestingUser.id !== userId) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to access this account',
    });
  }

  next();
};

// Helper function to sanitize user data (remove sensitive fields)
const sanitizeUserData = (user, isAdmin = false) => {
  const { ...userData } = user;

  // Fields to always exclude
  delete userData.password;
  delete userData.passwordResetToken;
  delete userData.passwordResetExpires;

  // Additional fields excluded for non-admin requests
  if (!isAdmin) {
    delete userData.role;
  }

  return userData;
};

// GET /api/users/:userId - Get user account data by ID
router.get(
  '/users/:userId',
  authenticateToken,
  validateUserId,
  authorizeAccess,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const isAdmin = req.user.role === 'admin';

      // Simulate async database query
      const user = await new Promise((resolve) => {
        setTimeout(() => resolve(users[userId] || null), 50);
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with ID '${userId}' not found`,
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'This account has been deactivated',
        });
      }

      const sanitizedUser = sanitizeUserData(user, isAdmin);

      return res.status(200).json({
        success: true,
        message: 'User account data retrieved successfully',
        data: sanitizedUser,
      });
    } catch (error) {
      console.error(`Error retrieving user account [userId=${req.params.userId}]:`, error);
      return res.status(500).json({
        success: false,
        message: 'An internal server error occurred while retrieving user data',
      });
    }
  }
);

// Optional: GET /api/users/me - Get current authenticated user's data
router.get('/users/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await new Promise((resolve) => {
      setTimeout(() => resolve(users[userId] || null), 50);
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated',
      });
    }

    const sanitizedUser = sanitizeUserData(user);

    return res.status(200).json({
      success: true,
      message: 'Current user account data retrieved successfully',
      data: sanitizedUser,
    });
  } catch (error) {
    console.error('Error retrieving current user account:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred while retrieving user data',
    });
  }
});

// App setup
const app = express();
app.use(express.json());
app.use('/api', router);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, router };