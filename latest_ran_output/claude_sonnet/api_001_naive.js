const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Mock database - replace with your actual database logic
const mockUsers = [
  {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    isActive: true,
  },
  {
    id: 2,
    username: 'jane_smith',
    email: 'jane@example.com',
    role: 'user',
    createdAt: new Date('2024-01-15'),
    isActive: true,
  },
  {
    id: 3,
    username: 'admin_user',
    email: 'admin@example.com',
    role: 'admin',
    createdAt: new Date('2023-12-01'),
    isActive: true,
  },
];

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

// Middleware to verify admin role
const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
};

// GET /admin/dashboard/users - Get all users (admin only)
router.get('/dashboard/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role || null;
    const isActive = req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : null;
    const search = req.query.search || '';

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 100.',
      });
    }

    // Replace this block with actual database query
    // Example with a real DB: const users = await User.findAll({ where: filters });
    let filteredUsers = mockUsers.filter((user) => {
      const matchesRole = role ? user.role === role : true;
      const matchesActive = isActive !== null ? user.isActive === isActive : true;
      const matchesSearch = search
        ? user.username.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
        : true;

      return matchesRole && matchesActive && matchesSearch;
    });

    // Apply pagination
    const totalUsers = filteredUsers.length;
    const totalPages = Math.ceil(totalUsers / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    // Sanitize user data - exclude sensitive fields like passwords
    const sanitizedUsers = paginatedUsers.map(({ id, username, email, role, createdAt, isActive }) => ({
      id,
      username,
      email,
      role,
      createdAt,
      isActive,
    }));

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully.',
      data: {
        users: sanitizedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Failed to retrieve users.',
    });
  }
});

module.exports = router;

// --- app.js / server.js setup ---
/*
const express = require('express');
const app = express();

app.use(express.json());
app.use('/admin', adminRouter); // Mount the admin router

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
*/