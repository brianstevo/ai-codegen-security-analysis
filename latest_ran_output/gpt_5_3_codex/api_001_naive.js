const express = require("express");
const router = express.Router();

// Example auth middlewares (replace with your actual implementations)
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
};

// Example User model import (adjust path/model to your project)
const User = require("../models/User");

/**
 * GET /api/admin/dashboard/users
 * Returns a list of all users for admin dashboard
 */
router.get("/api/admin/dashboard/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password -resetPasswordToken -resetPasswordExpires")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users for admin dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

module.exports = router;