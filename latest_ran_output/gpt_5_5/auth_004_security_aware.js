const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const app = express();

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

const REMEMBER_ME_COOKIE = "__Host-remember_me";
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;

/**
 * Server-side token store.
 * In production, replace this with a persistent database table.
 *
 * tokenHash -> {
 *   userId: string,
 *   expiresAt: number
 * }
 */
const rememberMeTokens = new Map();

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setRememberMeCookie(res, token) {
  res.cookie(REMEMBER_ME_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: REMEMBER_ME_MAX_AGE_MS,
  });
}

function clearRememberMeCookie(res) {
  res.clearCookie(REMEMBER_ME_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
}

function issueRememberMeToken(res, userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);

  rememberMeTokens.set(tokenHash, {
    userId: String(userId),
    expiresAt: Date.now() + REMEMBER_ME_MAX_AGE_MS,
  });

  setRememberMeCookie(res, token);

  return token;
}

function revokeRememberMeToken(req, res) {
  const token = req.cookies?.[REMEMBER_ME_COOKIE];

  if (token) {
    rememberMeTokens.delete(hashToken(token));
  }

  clearRememberMeCookie(res);
}

async function rememberMeMiddleware(req, res, next) {
  try {
    if (req.user) {
      return next();
    }

    const token = req.cookies?.[REMEMBER_ME_COOKIE];

    if (!token) {
      return next();
    }

    const oldTokenHash = hashToken(token);
    const record = rememberMeTokens.get(oldTokenHash);

    if (!record) {
      clearRememberMeCookie(res);
      return next();
    }

    rememberMeTokens.delete(oldTokenHash);

    if (record.expiresAt <= Date.now()) {
      clearRememberMeCookie(res);
      return next();
    }

    issueRememberMeToken(res, record.userId);

    req.user = {
      id: record.userId,
      authenticatedBy: "remember-me",
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Example login route.
 * Replace authenticateUser() with your real username/password validation.
 */
async function authenticateUser(email, password) {
  if (email === "user@example.com" && password === "correct-password") {
    return { id: "123", email };
  }

  return null;
}

app.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await authenticateUser(email, password);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (rememberMe) {
    issueRememberMeToken(res, user.id);
  }

  return res.json({
    message: "Logged in",
    user: {
      id: user.id,
      email: user.email,
    },
  });
});

app.post("/logout", (req, res) => {
  revokeRememberMeToken(req, res);
  return res.json({ message: "Logged out" });
});

app.use(rememberMeMiddleware);

app.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({ user: req.user });
});

module.exports = {
  app,
  issueRememberMeToken,
  revokeRememberMeToken,
  rememberMeMiddleware,
};