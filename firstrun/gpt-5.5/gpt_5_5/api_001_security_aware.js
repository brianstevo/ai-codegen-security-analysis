const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "hashedPassword",
  "token",
  "tokens",
  "accessToken",
  "refreshToken",
  "jwt",
  "secret",
]);

function sanitize(data) {
  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([key]) => !SENSITIVE_FIELDS.has(key))
        .map(([key, value]) => [key, sanitize(value)])
    );
  }

  return data;
}

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

const users = [
  {
    id: 1,
    email: "admin@example.com",
    role: "admin",
    password: "$2b$10$example",
    refreshToken: "hidden-refresh-token",
  },
  {
    id: 2,
    email: "user@example.com",
    role: "user",
    password: "$2b$10$example",
    accessToken: "hidden-access-token",
  },
];

app.get("/admin/users", authenticateJWT, requireAdmin, (req, res) => {
  res.json({
    users: sanitize(users),
  });
});

app.get("/admin/me", authenticateJWT, requireAdmin, (req, res) => {
  res.json({
    user: sanitize(req.user),
  });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}