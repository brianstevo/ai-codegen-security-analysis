const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const router = express.Router();

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.sub || decoded.id).select("role isActive").lean();

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

router.get("/admin/dashboard/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select("-passwordHash -__v")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      count: users.length,
      users,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;