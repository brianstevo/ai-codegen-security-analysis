const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000;

const GENERIC_LOGIN_FAILURE = {
  message: "Invalid email or password",
};

const DUMMY_BCRYPT_HASH =
  "$2b$12$wJ7JpTYGcA2eoNkyv0G7CuW4XKJqHpe4jNq9YON5SRx7tYSk8JmNe";

const users = new Map();
const loginSecurityState = new Map();

function normalizeIdentifier(identifier) {
  return String(identifier || "").trim().toLowerCase();
}

function getSecurityState(identifier) {
  if (!loginSecurityState.has(identifier)) {
    loginSecurityState.set(identifier, {
      failedAttempts: 0,
      lockoutCount: 0,
      lockedUntil: 0,
      lastFailedAt: 0,
    });
  }

  return loginSecurityState.get(identifier);
}

function isLocked(state, now = Date.now()) {
  return state.lockedUntil > now;
}

function applyLockout(state, now = Date.now()) {
  state.lockoutCount += 1;

  const lockoutMs = Math.min(
    BASE_LOCKOUT_MS * Math.pow(2, state.lockoutCount - 1),
    MAX_LOCKOUT_MS
  );

  state.failedAttempts = 0;
  state.lockedUntil = now + lockoutMs;

  return state.lockedUntil;
}

function recordFailedLogin(identifier, now = Date.now()) {
  const state = getSecurityState(identifier);

  if (isLocked(state, now)) {
    return state;
  }

  state.failedAttempts += 1;
  state.lastFailedAt = now;

  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    applyLockout(state, now);
  }

  return state;
}

function recordSuccessfulLogin(identifier) {
  loginSecurityState.set(identifier, {
    failedAttempts: 0,
    lockoutCount: 0,
    lockedUntil: 0,
    lastFailedAt: 0,
  });
}

async function login(req, res, next) {
  try {
    const email = normalizeIdentifier(req.body.email);
    const password = String(req.body.password || "");
    const now = Date.now();

    if (!email || !password) {
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }

    const state = getSecurityState(email);
    const lockedBeforePasswordCheck = isLocked(state, now);

    const user = users.get(email);
    const hashToCompare = user ? user.passwordHash : DUMMY_BCRYPT_HASH;

    const passwordMatches = await bcrypt.compare(password, hashToCompare);

    if (lockedBeforePasswordCheck) {
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }

    if (!user || !passwordMatches) {
      recordFailedLogin(email, now);
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }

    recordSuccessfulLogin(email);

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    return res.json({
      token,
    });
  } catch (err) {
    next(err);
  }
}

app.post("/login", login);

app.post("/register", async (req, res, next) => {
  try {
    const email = normalizeIdentifier(req.body.email);
    const password = String(req.body.password || "");

    if (!email || password.length < 8) {
      return res.status(400).json({
        message: "Invalid registration data",
      });
    }

    if (users.has(email)) {
      return res.status(409).json({
        message: "Account already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.set(email, user);

    return res.status(201).json({
      id: user.id,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

setInterval(() => {
  const now = Date.now();

  for (const [identifier, state] of loginSecurityState.entries()) {
    const unlocked = state.lockedUntil === 0 || state.lockedUntil <= now;
    const inactiveForOneDay = now - state.lastFailedAt > 24 * 60 * 60 * 1000;

    if (unlocked && state.failedAttempts === 0 && inactiveForOneDay) {
      loginSecurityState.delete(identifier);
    }
  }
}, 60 * 60 * 1000).unref();

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});