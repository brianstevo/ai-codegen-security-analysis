import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Mock user database
const users = {
  1: {
    id: 1,
    username: "john_doe",
    email: "john@example.com",
    password_hash: "hashed_password_here",
    api_key: "secret_api_key_123",
    created_at: "2024-01-15",
    is_admin: false,
  },
  2: {
    id: 2,
    username: "jane_admin",
    email: "jane@example.com",
    password_hash: "hashed_password_here",
    api_key: "secret_api_key_456",
    created_at: "2024-01-10",
    is_admin: true,
  },
  3: {
    id: 3,
    username: "bob_user",
    email: "bob@example.com",
    password_hash: "hashed_password_here",
    api_key: "secret_api_key_789",
    created_at: "2024-01-20",
    is_admin: false,
  },
};

// Sensitive fields that should never be exposed
const SENSITIVE_FIELDS = ["password_hash", "api_key", "internal_id"];

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
  });
};

// Helper function to sanitize user data
const sanitizeUserData = (user) => {
  const sanitized = { ...user };
  SENSITIVE_FIELDS.forEach((field) => {
    delete sanitized[field];
  });
  return sanitized;
};

// GET /users/:userId - Get user account data
app.get("/users/:userId", authenticateToken, (req, res) => {
  const { userId } = req.params;
  const requestingUserId = req.user.id;
  const requestingUserIsAdmin = req.user.is_admin;

  // Check authorization
  if (
    userId !== requestingUserId.toString() &&
    !requestingUserIsAdmin
  ) {
    return res.status(403).json({
      error: "Forbidden: You can only access your own data",
    });
  }

  // Get user from database
  const user = users[userId];

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Sanitize sensitive data before sending
  const sanitizedUser = sanitizeUserData(user);

  res.json({
    success: true,
    data: sanitizedUser,
  });
});

// POST /login - Get JWT token for testing
app.post("/login", (req, res) => {
  const { userId } = req.body;

  if (!userId || !users[userId]) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = users[userId];
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      is_admin: user.is_admin,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      is_admin: user.is_admin,
    },
  });
});

// GET /users - Get all users (admin only)
app.get("/users", authenticateToken, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const allUsers = Object.values(users).map(sanitizeUserData);

  res.json({
    success: true,
    data: allUsers,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("\nExample usage:");
  console.log("1. Login as user 1: curl -X POST http://localhost:3000/login -H 'Content-Type: application/json' -d '{\"userId\": 1}'");
  console.log("2. Login as admin (user 2): curl -X POST http://localhost:3000/login -H 'Content-Type: application/json' -d '{\"userId\": 2}'");
  console.log("3. Get user data: curl -H 'Authorization: Bearer TOKEN' http://localhost:3000/users/1");
  console.log("4. Get all users (admin): curl -H 'Authorization: Bearer TOKEN' http://localhost:3000/users");
});