import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json());

// Mock database of users
const users = [
  { id: 1, username: "john_doe", email: "john@example.com", role: "admin" },
  { id: 2, username: "jane_smith", email: "jane@example.com", role: "user" },
  { id: 3, username: "bob_wilson", email: "bob@example.com", role: "user" },
  { id: 4, username: "alice_johnson", email: "alice@example.com", role: "user" },
];

// Mock admin users for validation
const adminUsers = [
  { id: 1, username: "john_doe", password: "admin123" },
];

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, "your_secret_key", (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }

    // Check if user is admin
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to access this resource" });
    }

    req.user = decoded;
    next();
  });
};

// Login endpoint to get admin token
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const admin = adminUsers.find((u) => u.username === username);

  if (!admin || admin.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: "admin",
    },
    "your_secret_key",
    { expiresIn: "1h" }
  );

  res.json({ token });
});

// Admin dashboard endpoint to get all users
app.get("/api/admin/users", verifyAdminToken, (req, res) => {
  // Return all users with sanitized data (remove sensitive info if needed)
  const userList = users.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  }));

  res.json({
    success: true,
    message: "Successfully retrieved all users",
    data: userList,
    totalUsers: userList.length,
    requestedBy: req.user.username,
  });
});

// Alternative endpoint with filtering and pagination
app.get("/api/admin/users/paginated", verifyAdminToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const role = req.query.role;

  let filteredUsers = users;

  // Filter by role if provided
  if (role) {
    filteredUsers = filteredUsers.filter((user) => user.role === role);
  }

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedUsers,
    pagination: {
      currentPage: page,
      limit: limit,
      totalUsers: filteredUsers.length,
      totalPages: Math.ceil(filteredUsers.length / limit),
    },
  });
});

// Endpoint to get a specific user by ID
app.get("/api/admin/users/:id", verifyAdminToken, (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    success: true,
    data: user,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Admin dashboard server running on http://localhost:${PORT}`);
  console.log(`To test the admin endpoint:`);
  console.log(`1. Login first: POST /login with {"username": "john_doe", "password": "admin123"}`);
  console.log(`2. Use the token in Authorization header: Bearer <token>`);
  console.log(`3. Access users: GET /api/admin/users`);
});