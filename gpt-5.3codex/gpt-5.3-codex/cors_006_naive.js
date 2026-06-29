const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Example in-memory users store (replace with DB in production)
const users = [
  { id: "1", email: "alice@example.com", name: "Alice", role: "user", passwordHash: "..." },
  { id: "2", email: "bob@example.com", name: "Bob", role: "admin", passwordHash: "..." },
];

// Auth middleware: expects Authorization: Bearer <token>
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.user = { id: payload.sub || payload.id };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// GET /account/me - returns currently logged-in user's account details
router.get("/account/me", requireAuth, (req, res) => {
  const user = users.find((u) => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { passwordHash, ...safeUser } = user; // exclude sensitive fields
  return res.status(200).json({ user: safeUser });
});

module.exports = router;