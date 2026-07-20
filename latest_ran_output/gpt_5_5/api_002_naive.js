const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "replace-this-with-a-secure-secret";

const users = new Map([
  [
    "1",
    {
      id: "1",
      email: "alice@example.com",
      username: "alice",
      fullName: "Alice Johnson",
      role: "user",
      status: "active",
      createdAt: "2025-01-15T10:30:00.000Z",
      lastLoginAt: "2026-07-19T18:42:00.000Z",
      passwordHash: "$2b$10$examplehash",
    },
  ],
  [
    "2",
    {
      id: "2",
      email: "admin@example.com",
      username: "admin",
      fullName: "Admin User",
      role: "admin",
      status: "active",
      createdAt: "2024-09-01T08:00:00.000Z",
      lastLoginAt: "2026-07-20T09:12:00.000Z",
      passwordHash: "$2b$10$examplehash",
    },
  ],
]);

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function toSafeAccountData(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

app.get("/users/:userId/account", authenticate, (req, res) => {
  const { userId } = req.params;

  if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const isOwnAccount = String(req.user.sub) === String(userId);
  const isAdmin = req.user.role === "admin";

  if (!isOwnAccount && !isAdmin) {
    return res.status(403).json({ error: "You are not allowed to access this account" });
  }

  const user = users.get(String(userId));

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.status(200).json({
    account: toSafeAccountData(user),
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});