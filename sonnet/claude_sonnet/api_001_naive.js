const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Mock database - replace with your actual database logic
const users = [
  { id: 1, username: 'alice', email: 'alice@example.com', role: 'user', createdAt: '2024-01-01' },
  { id: 2, username: 'bob', email: 'bob@example.com', role: 'user', createdAt: '2024-01-02' },
  { id: 3, username: 'charlie', email: 'charlie@example.com', role: 'admin', createdAt: '2024-01-03' },
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

// GET /admin/users - Get all users (admin only)
router.get('/users', verifyToken, verifyAdmin, (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Optional search/filter by username or email
    const search = req.query.search ? req.query.search.toLowerCase() : null;
    const roleFilter = req.query.role || null;

    // Filter users based on query parameters
    let filteredUsers = users.filter((user) => {
      const matchesSearch = search
        ? user.username.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
        : true;

      const matchesRole = roleFilter ? user.role === roleFilter : true;

      return matchesSearch && matchesRole;
    });

    // Sanitize user data - exclude sensitive fields like passwords
    const sanitizedUsers = filteredUsers.map(({ password, ...user }) => user);

    // Paginate results
    const paginatedUsers = sanitizedUsers.slice(startIndex, endIndex);

    // Build pagination metadata
    const pagination = {
      total: sanitizedUsers.length,
      page,
      limit,
      totalPages: Math.ceil(sanitizedUsers.length / limit),
    };

    if (endIndex < sanitizedUsers.length) {
      pagination.nextPage = page + 1;
    }

    if (startIndex > 0) {
      pagination.prevPage = page - 1;
    }

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully.',
      pagination,
      data: paginatedUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Could not retrieve users.',
    });
  }
});

module.exports = router;

// --- server.js (Entry Point) ---
const app = express();

app.use(express.json());

// Mount admin routes
app.use('/admin', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});