const express = require("express");
const session = require("express-session");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "replace-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  })
);

const JWT_SECRET = process.env.JWT_SECRET || "replace-this-jwt-secret";

/*
  Example user store. Replace these helpers with your database calls.
*/
const users = new Map([
  [
    "1",
    {
      id: "1",
      email: "alice@example.com",
      username: "alice",
      fullName: "Alice Smith",
      role: "user",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-10T00:00:00.000Z",
      profile: {
        avatarUrl: "https://example.com/avatar/alice.png",
        timezone: "UTC",
      },

      password: "never-return-this",
      passwordHash: "$2b$12$example",
      resetPasswordToken: "secret",
      resetPasswordExpires: "2025-01-01T00:00:00.000Z",
      emailVerificationToken: "secret",
      mfaSecret: "secret",
      refreshTokens: ["secret"],
      apiKeys: ["secret"],
      ssn: "000-00-0000",
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
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-10T00:00:00.000Z",
      profile: {
        avatarUrl: "https://example.com/avatar/admin.png",
        timezone: "UTC",
      },

      passwordHash: "$2b$12$example",
      mfaSecret: "secret",
      refreshTokens: ["secret"],
      apiKeys: ["secret"],
    },
  ],
]);

async function findUserById(id) {
  return users.get(String(id)) || null;
}

function stripSensitiveUserFields(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile
      ? {
          avatarUrl: user.profile.avatarUrl,
          timezone: user.profile.timezone,
        }
      : undefined,
  };
}

async function authenticateRequest(req, res, next) {
  try {
    let authenticatedUserId = null;

    if (req.session && req.session.userId) {
      authenticatedUserId = req.session.userId;
    } else {
      const authHeader = req.get("authorization") || "";
      const [scheme, token] = authHeader.split(" ");

      if (scheme === "Bearer" && token) {
        const payload = jwt.verify(token, JWT_SECRET);
        authenticatedUserId = payload.sub || payload.userId || payload.id;
      }
    }

    if (!authenticatedUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const authenticatedUser = await findUserById(authenticatedUserId);

    if (!authenticatedUser) {
      return res.status(401).json({ error: "Invalid authentication" });
    }

    req.user = authenticatedUser;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

app.get("/users/:userId/account", authenticateRequest, async (req, res, next) => {
  try {
    const requestedUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
    const isOwner = String(req.user.id) === String(requestedUserId);
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const requestedUser = await findUserById(requestedUserId);

    if (!requestedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: stripSensitiveUserFields(requestedUser) });
  } catch (err) {
    next(err);
  }
});

app.post("/login/demo", async (req, res) => {
  const { userId = "1", authType = "jwt" } = req.body || {};
  const user = await findUserById(userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (authType === "session") {
    req.session.userId = user.id;
    return res.json({ ok: true, authType: "session" });
  }

  const token = jwt.sign(
    {
      sub: user.id,
    },
    JWT_SECRET,
    {
      expiresIn: "15m",
      issuer: "example-api",
      audience: "example-client",
    }
  );

  return res.json({ token });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}