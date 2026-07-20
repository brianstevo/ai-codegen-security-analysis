const express = require("express");
const jwt = require("jsonwebtoken");
const session = require("express-session");

const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "replace-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

const JWT_SECRET = process.env.JWT_SECRET || "replace-this-jwt-secret";

const users = new Map([
  [
    "1",
    {
      id: "1",
      email: "user@example.com",
      name: "Regular User",
      role: "user",
      createdAt: "2026-01-01T00:00:00.000Z",
      password: "plaintext-should-never-be-stored",
      passwordHash: "$2b$10$example",
      passwordResetToken: "secret-reset-token",
      mfaSecret: "secret-mfa-value",
      refreshToken: "secret-refresh-token",
      ssn: "123-45-6789",
    },
  ],
  [
    "2",
    {
      id: "2",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      passwordHash: "$2b$10$example",
      mfaSecret: "secret-mfa-value",
    },
  ],
]);

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function findUserById(userId) {
  return users.get(String(userId)) || null;
}

function sanitizeUser(user) {
  const {
    password,
    passwordHash,
    passwordSalt,
    salt,
    passwordResetToken,
    passwordResetExpires,
    emailVerificationToken,
    emailVerificationExpires,
    refreshToken,
    refreshTokens,
    mfaSecret,
    twoFactorSecret,
    totpSecret,
    apiKey,
    apiKeys,
    accessToken,
    privateKey,
    ssn,
    ...safeUser
  } = user;

  return safeUser;
}

async function authenticate(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const sessionUser = await findUserById(req.session.userId);

      if (!sessionUser) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "Unauthenticated" });
      }

      req.user = {
        id: sessionUser.id,
        role: sessionUser.role,
      };

      return next();
    }

    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const jwtUser = await findUserById(payload.sub);

    if (!jwtUser) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    req.user = {
      id: jwtUser.id,
      role: jwtUser.role,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireSelfOrAdmin(req, res, next) {
  const requestedUserId = String(req.params.userId);
  const authenticatedUserId = String(req.user.id);
  const isAdmin = req.user.role === "admin";

  if (!isAdmin && requestedUserId !== authenticatedUserId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

app.get("/users/:userId", authenticate, requireSelfOrAdmin, async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login-demo/:userId", async (req, res) => {
  const user = await findUserById(req.params.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  req.session.userId = user.id;

  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "15m",
    }
  );

  return res.json({ token });
});

module.exports = app;