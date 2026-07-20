const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Mock database (replace with actual database calls)
const users = [
  {
    id: '1',
    username: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
    isActive: true,
    profilePicture: null,
    lastLogin: '2024-01-10T12:00:00Z',
  },
  {
    id: '2',
    username: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'admin',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-11T00:00:00Z',
    isActive: true,
    profilePicture: null,
    lastLogin: '2024-01-11T09:00:00Z',
  },
];

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

// Middleware to authorize access (user can only access their own data unless admin)
const authorizeAccess = (req, res, next) => {
  const requestedUserId = req.params.userId;
  const requestingUserId = req.user.id;
  const requestingUserRole = req.user.role;

  if (requestingUserId === requestedUserId || requestingUserRole === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own account data.',
    });
  }
};

// Helper function to sanitize user data (remove sensitive fields)
const sanitizeUserData = (user) => {
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
};

// Helper function to find user by ID (replace with actual DB query)
const findUserById = async (userId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const user = users.find((u) => u.id === userId);
      resolve(user || null);
    }, 50); // Simulate async DB call
  });
};

// GET /api/users/:userId - Get user account data by ID
router.get('/:userId', authenticateToken, authorizeAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format (basic validation)
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    // Fetch user from database
    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID '${userId}' not found.`,
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated.',
      });
    }

    // Sanitize and return user data
    const sanitizedUser = sanitizeUserData(user);

    return res.status(200).json({
      success: true,
      message: 'User account data retrieved successfully.',
      data: sanitizedUser,
    });
  } catch (error) {
    console.error('Error fetching user account data:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Failed to retrieve user account data.',
    });
  }
});

// GET /api/users/:userId/summary - Get a brief summary of user account
router.get('/:userId/summary', authenticateToken, authorizeAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID '${userId}' not found.`,
      });
    }

    // Return only a summary of the user data
    const userSummary = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      profilePicture: user.profilePicture,
    };

    return res.status(200).json({
      success: true,
      message: 'User summary retrieved successfully.',
      data: userSummary,
    });
  } catch (error) {
    console.error('Error fetching user summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Failed to retrieve user summary.',
    });
  }
});

module.exports = router;

// --- Main app setup (app.js or server.js) ---
/*
const express = require('express');
const app = express();

app.use(express.json());
app.use('/api/users', require('./routes/userRoutes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/

// --- Example API Usage ---
/*
GET /api/users/1
Headers:
  Authorization: Bearer <your_jwt_token>

Success Response (200):
{
  "success": true,
  "message": "User account data retrieved successfully.",
  "data": {
    "id": "1",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-10T00:00:00Z",
    "isActive": true,
    "profilePicture": null,
    "lastLogin": "2024-01-10T12:00:00Z"
  }
}

Error Response (404):
{
  "success": false,
  "message": "User with ID '99' not found."
}
*/