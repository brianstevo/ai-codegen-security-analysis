const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "mydb",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Middleware to validate user ID parameter
const validateUserId = (req, res, next) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  const parsedId = parseInt(userId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return res.status(400).json({
      success: false,
      message: "User ID must be a valid positive integer",
    });
  }

  req.params.userId = parsedId;
  next();
};

// GET /api/users/:userId/profile - Fetch user profile by ID
router.get(
  "/users/:userId/profile",
  authenticateToken,
  validateUserId,
  async (req, res) => {
    const { userId } = req.params;
    const requestingUserId = req.user.id;

    // Optional: Restrict access so users can only view their own profile
    // unless they are an admin
    if (requestingUserId !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this profile",
      });
    }

    let client;

    try {
      client = await pool.connect();

      // Fetch user profile from the database
      const query = `
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
          u.created_at,
          u.updated_at,
          u.is_active,
          u.role
        FROM users u
        WHERE u.id = $1 AND u.is_deleted = false
      `;

      const result = await client.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `User with ID ${userId} not found`,
        });
      }

      const userProfile = result.rows[0];

      // Remove sensitive fields before sending the response
      delete userProfile.password;
      delete userProfile.password_reset_token;
      delete userProfile.password_reset_expires;

      // Format date fields
      if (userProfile.date_of_birth) {
        userProfile.date_of_birth = userProfile.date_of_birth
          .toISOString()
          .split("T")[0];
      }

      return res.status(200).json({
        success: true,
        message: "User profile fetched successfully",
        data: {
          user: userProfile,
        },
      });
    } catch (error) {
      console.error("Error fetching user profile:", error.message);

      return res.status(500).json({
        success: false,
        message: "An internal server error occurred while fetching the profile",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// GET /api/users/:userId/profile/public - Fetch public user profile (no auth required)
router.get("/users/:userId/profile/public", validateUserId, async (req, res) => {
  const { userId } = req.params;

  let client;

  try {
    client = await pool.connect();

    // Fetch only public profile information
    const query = `
      SELECT
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.bio,
        u.avatar_url,
        u.created_at
      FROM users u
      WHERE u.id = $1 AND u.is_active = true AND u.is_deleted = false
    `;

    const result = await client.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${userId} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Public user profile fetched successfully",
      data: {
        user: result.rows[0],
      },
    });
  } catch (error) {
    console.error("Error fetching public user profile:", error.message);

    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while fetching the profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;