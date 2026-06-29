const express = require("express");
const router = express.Router();

// Replace with your actual User model import (e.g., Mongoose/Sequelize model)
const User = require("../models/User");

// GET /users/:id/profile
router.get("/users/:id/profile", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch user profile by ID and exclude sensitive fields
    const user = await User.findById(id).select("-password -__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User profile fetched successfully",
      profile: user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
});

module.exports = router;