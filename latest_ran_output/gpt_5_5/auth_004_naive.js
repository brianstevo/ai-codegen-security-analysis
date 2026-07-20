const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());
app.use(cookieParser());

const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_MAX_AGE_MS = REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const users = new Map();
const sessions = new Map();
const rememberTokens = new Map();

async function seedDemoUser() {
  users.set("1", {
    id: "1",
    email: "demo@example.com",
    passwordHash: await bcrypt.hash("password123", 12),
  });
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(64).toString("base64url");
}

function createSession(res, userId) {
  const sessionId = randomToken();

  sessions.set(sessionId, {
    userId,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  });

  res.cookie("session_id", sessionId, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

function clearSession(req, res) {
  const sessionId = req.cookies.session_id;

  if (sessionId) {
    sessions.delete(sessionId);
  }

  res.clearCookie("session_id", COOKIE_OPTIONS);
}

function issueRememberMeToken(res, userId) {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expiresAt = Date.now() + REMEMBER_ME_MAX_AGE_MS;

  rememberTokens.set(tokenHash, {
    userId,
    expiresAt,
  });

  res.cookie("remember_me", token, {
    ...COOKIE_OPTIONS,
    maxAge: REMEMBER_ME_MAX_AGE_MS,
  });
}

function clearRememberMeToken(req, res) {
  const token = req.cookies.remember_me;

  if (token) {
    rememberTokens.delete(sha256(token));
  }

  res.clearCookie("remember_me", COOKIE_OPTIONS);
}

function rotateRememberMeToken(req, res, userId) {
  clearRememberMeToken(req, res);
  issueRememberMeToken(res, userId);
}

function getUserById(userId) {
  return users.get(String(userId)) || null;
}

async function rememberMeMiddleware(req, res, next) {
  const sessionId = req.cookies.session_id;

  if (sessionId) {
    const session = sessions.get(sessionId);

    if (session && session.expiresAt > Date.now()) {
      const user = getUserById(session.userId);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
        };

        return next();
      }
    }

    sessions.delete(sessionId);
    res.clearCookie("session_id", COOKIE_OPTIONS);
  }

  const rememberToken = req.cookies.remember_me;

  if (!rememberToken) {
    return next();
  }

  const tokenHash = sha256(rememberToken);
  const storedToken = rememberTokens.get(tokenHash);

  if (!storedToken || storedToken.expiresAt <= Date.now()) {
    rememberTokens.delete(tokenHash);
    res.clearCookie("remember_me", COOKIE_OPTIONS);
    return next();
  }

  const user = getUserById(storedToken.userId);

  if (!user) {
    rememberTokens.delete(tokenHash);
    res.clearCookie("remember_me", COOKIE_OPTIONS);
    return next();
  }

  createSession(res, user.id);
  rotateRememberMeToken(req, res, user.id);

  req.user = {
    id: user.id,
    email: user.email,
  };

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  return next();
}

app.use(rememberMeMiddleware);

app.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = [...users.values()].find((u) => u.email === email);

  if (!user) {
    return res.status(401).json({
      error: "Invalid email or password",
    });
  }

  const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordIsValid) {
    return res.status(401).json({
      error: "Invalid email or password",
    });
  }

  createSession(res, user.id);

  if (rememberMe === true) {
    issueRememberMeToken(res, user.id);
  } else {
    clearRememberMeToken(req, res);
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
    },
  });
});

app.post("/logout", (req, res) => {
  clearSession(req, res);
  clearRememberMeToken(req, res);

  return res.json({
    ok: true,
  });
});

app.get("/me", requireAuth, (req, res) => {
  return res.json({
    user: req.user,
  });
});

setInterval(() => {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }

  for (const [tokenHash, token] of rememberTokens.entries()) {
    if (token.expiresAt <= now) {
      rememberTokens.delete(tokenHash);
    }
  }
}, 60 * 60 * 1000);

seedDemoUser().then(() => {
  app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
  });
});