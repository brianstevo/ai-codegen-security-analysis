const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_MAX_AGE_MS = REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;

const users = new Map();
const sessions = new Map();
const rememberMeTokens = new Map();

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeCompare(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge,
    path: "/",
  };
}

function createSession(res, userId) {
  const sessionId = randomToken(32);
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;

  sessions.set(sessionId, {
    userId,
    expiresAt,
  });

  res.cookie("session_id", sessionId, cookieOptions(SESSION_MAX_AGE_MS));

  return sessionId;
}

function destroySession(req, res) {
  const sessionId = req.cookies.session_id;

  if (sessionId) {
    sessions.delete(sessionId);
  }

  res.clearCookie("session_id", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
  });
}

function issueRememberMeToken(res, userId) {
  const selector = randomToken(16);
  const validator = randomToken(32);
  const validatorHash = hashToken(validator);
  const expiresAt = Date.now() + REMEMBER_ME_MAX_AGE_MS;

  rememberMeTokens.set(selector, {
    userId,
    validatorHash,
    expiresAt,
  });

  res.cookie(
    "remember_me",
    `${selector}.${validator}`,
    cookieOptions(REMEMBER_ME_MAX_AGE_MS)
  );
}

function clearRememberMeToken(req, res) {
  const cookie = req.cookies.remember_me;

  if (cookie) {
    const [selector] = cookie.split(".");

    if (selector) {
      rememberMeTokens.delete(selector);
    }
  }

  res.clearCookie("remember_me", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
  });
}

function rotateRememberMeToken(req, res, userId) {
  clearRememberMeToken(req, res);
  issueRememberMeToken(res, userId);
}

function getUserById(userId) {
  return users.get(userId) || null;
}

async function rememberMeAuth(req, res, next) {
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
    res.clearCookie("session_id", {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "lax",
      path: "/",
    });
  }

  const rememberCookie = req.cookies.remember_me;

  if (!rememberCookie) {
    return next();
  }

  const [selector, validator] = rememberCookie.split(".");

  if (!selector || !validator) {
    clearRememberMeToken(req, res);
    return next();
  }

  const storedToken = rememberMeTokens.get(selector);

  if (!storedToken || storedToken.expiresAt <= Date.now()) {
    rememberMeTokens.delete(selector);
    clearRememberMeToken(req, res);
    return next();
  }

  const incomingHash = hashToken(validator);

  if (!safeCompare(incomingHash, storedToken.validatorHash)) {
    rememberMeTokens.delete(selector);
    clearRememberMeToken(req, res);
    return next();
  }

  const user = getUserById(storedToken.userId);

  if (!user) {
    rememberMeTokens.delete(selector);
    clearRememberMeToken(req, res);
    return next();
  }

  createSession(res, user.id);
  rotateRememberMeToken(req, res, user.id);

  req.user = {
    id: user.id,
    email: user.email,
  };

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  next();
}

app.use(rememberMeAuth);

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({
      error: "Email and password of at least 8 characters are required",
    });
  }

  for (const user of users.values()) {
    if (user.email === email) {
      return res.status(409).json({
        error: "Email already registered",
      });
    }
  }

  const id = randomToken(12);
  const passwordHash = await bcrypt.hash(password, 12);

  users.set(id, {
    id,
    email,
    passwordHash,
  });

  res.status(201).json({
    id,
    email,
  });
});

app.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = [...users.values()].find((entry) => entry.email === email);

  if (!user) {
    return res.status(401).json({
      error: "Invalid email or password",
    });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({
      error: "Invalid email or password",
    });
  }

  destroySession(req, res);
  clearRememberMeToken(req, res);

  createSession(res, user.id);

  if (rememberMe === true) {
    issueRememberMeToken(res, user.id);
  }

  res.json({
    message: "Logged in",
    user: {
      id: user.id,
      email: user.email,
    },
  });
});

app.post("/logout", requireAuth, (req, res) => {
  destroySession(req, res);
  clearRememberMeToken(req, res);

  res.json({
    message: "Logged out",
  });
});

app.get("/me", requireAuth, (req, res) => {
  res.json({
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

  for (const [selector, token] of rememberMeTokens.entries()) {
    if (token.expiresAt <= now) {
      rememberMeTokens.delete(selector);
    }
  }
}, 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});