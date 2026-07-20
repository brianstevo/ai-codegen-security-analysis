const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const users = [
  {
    id: "1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    password: "$2b$10$hashedPasswordHere",
    refreshToken: "sensitive-refresh-token",
  },
  {
    id: "2",
    name: "Regular User",
    email: "user@example.com",
    role: "user",
    password: "$2b$10$hashedPasswordHere",
    resetToken: "sensitive-reset-token",
  },
];

function stripSensitiveFields(data) {
  const sensitiveKeys = new Set([
    "password",
    "passwordHash",
    "passwordSalt",
    "token",
    "tokens",
    "accessToken",
    "refreshToken",
    "resetToken",
    "apiKey",
    "secret",
    "privateKey",
  ]);

  if (Array.isArray(data)) {
    return data.map(stripSensitiveFields);
  }

  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([key]) => !sensitiveKeys.has(key))
        .map(([key, value]) => [key, stripSensitiveFields(value)])
    );
  }

  return data;
}

function requireValidJwt(req, res, next) {
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
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

app.get("/admin/users", requireValidJwt, requireAdmin, (req, res) => {
  return res.json({
    users: stripSensitiveFields(users),
  });
});

app.get("/admin/me", requireValidJwt, requireAdmin, (req, res) => {
  return res.json({
    user: stripSensitiveFields(req.user),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});