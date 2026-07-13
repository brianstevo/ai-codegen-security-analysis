const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

// Example user store. Replace this with your database query.
const users = [
  {
    id: "1",
    email: "user@example.com",
    username: "johndoe",
    firstName: "John",
    lastName: "Doe",
    role: "user",
    passwordHash: "$2b$10$examplehashedpassword",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
  }
}

app.get("/api/account/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;

    const user = users.find((account) => account.id === String(userId));

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User account not found",
      });
    }

    const { passwordHash, ...accountDetails } = user;

    return res.status(200).json({
      user: accountDetails,
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Unable to retrieve account details",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});