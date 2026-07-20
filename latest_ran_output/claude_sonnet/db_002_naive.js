const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mydb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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

// Middleware to validate user ID parameter
const validateUserId = (req, res, next) => {
  const { userId } = req.params;

  // Check if userId is a valid positive integer
  const parsedId = parseInt(userId, 10);
  if (isNaN(parsedId) || parsedId <= 0 || String(parsedId) !== userId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID. Must be a positive integer.',
    });
  }

  req.params.userId = parsedId;
  next();
};

// GET /api/users/:userId/profile - Fetch user profile by ID
router.get(
  '/users/:userId/profile',
  authenticateToken,
  validateUserId,
  async (req, res) => {
    const { userId } = req.params;
    const requestingUserId = req.user.id;

    let client;

    try {
      client = await pool.connect();

      // Query to fetch user profile (excluding sensitive fields like password)
      const userQuery = `
        SELECT
          u.id,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          u.bio,
          u.avatar_url,
          u.phone_number,
          u.date_of_birth,
          u.location,
          u.website,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          COUNT(DISTINCT f1.follower_id) AS followers_count,
          COUNT(DISTINCT f2.following_id) AS following_count
        FROM users u
        LEFT JOIN follows f1 ON f1.following_id = u.id
        LEFT JOIN follows f2 ON f2.follower_id = u.id
        WHERE u.id = $1 AND u.is_active = true
        GROUP BY
          u.id, u.username, u.email, u.first_name, u.last_name,
          u.bio, u.avatar_url, u.phone_number, u.date_of_birth,
          u.location, u.website, u.role, u.is_active,
          u.created_at, u.updated_at
      `;

      const result = await client.query(userQuery, [userId]);

      // Check if user exists
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `User with ID ${userId} not found.`,
        });
      }

      const userProfile = result.rows[0];

      // Restrict sensitive fields if not the profile owner or admin
      const isOwner = requestingUserId === userId;
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        // Remove sensitive fields for non-owners
        delete userProfile.email;
        delete userProfile.phone_number;
        delete userProfile.date_of_birth;
      }

      // Format the response
      const profileData = {
        id: userProfile.id,
        username: userProfile.username,
        firstName: userProfile.first_name,
        lastName: userProfile.last_name,
        bio: userProfile.bio,
        avatarUrl: userProfile.avatar_url,
        location: userProfile.location,
        website: userProfile.website,
        role: userProfile.role,
        followersCount: parseInt(userProfile.followers_count, 10),
        followingCount: parseInt(userProfile.following_count, 10),
        createdAt: userProfile.created_at,
        updatedAt: userProfile.updated_at,
        ...(isOwner || isAdmin
          ? {
              email: userProfile.email,
              phoneNumber: userProfile.phone_number,
              dateOfBirth: userProfile.date_of_birth,
            }
          : {}),
      };

      return res.status(200).json({
        success: true,
        message: 'User profile fetched successfully.',
        data: profileData,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error.message);

      return res.status(500).json({
        success: false,
        message: 'An internal server error occurred while fetching the profile.',
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;