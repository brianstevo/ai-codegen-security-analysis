const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

/**
 * Example in-memory users store.
 * Replace with your DB model/service in production.
 */
const users = [
  {
    id: "1",
    email: "alice@example.com",
    name: "Alice",
    role: "user",
    passwordHash: "$2b$10$examplehash",
    resetToken: "secret-reset-token",
    mfaSecret: "secret-mfa",
    createdAt: new Date("2024-01-01").toISOString(),
  },
  {
    id: "2",
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    passwordHash: "$2b$10$examplehash",
    resetToken: "admin-reset-token",
    mfaSecret: "admin-mfa",
    createdAt: new Date("2024-01-02").toISOString(),
  },
];

const JWT_SECRET = process.env.JWT_SECRET || "replace-with-secure-secret";

/**
 * Authentication middleware supporting:
 * 1) Session-based auth: req.session.user
 * 2) JWT auth: Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  // Session auth
  if (req.session && req.session.user && req.session.user.id) {
    req.authUser = {
      id: String(req.session.user.id),
      role: req.session.user.role || "user",
    };
    return next();
  }

  // JWT auth
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.authUser = {
      id: String(payload.sub || payload.id),
      role: payload.role || "user",
    };
    if (!req.authUser.id) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Removes sensitive fields before responding.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const {
    password,
    passwordHash,
    resetToken,
    mfaSecret,
    verificationToken,
    ...safeUser
  } = user;
  return safeUser;
}

/**
 * GET /accounts/:userId
 * - Auth required
 * - User can fetch their own account
 * - Admin can fetch any account
 */
router.get("/accounts/:userId", authenticate, async (req, res) => {
  const requestedUserId = String(req.params.userId);
  const isAdmin = req.authUser.role === "admin";
  const isSelf = req.authUser.id === requestedUserId;

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Replace with DB call, e.g., User.findById(requestedUserId)
  const user = users.find((u) => String(u.id) === requestedUserId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.status(200).json({ user: sanitizeUser(user) });
});

module.exports = router;