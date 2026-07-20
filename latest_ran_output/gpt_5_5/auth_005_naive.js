const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

const users = new Map();

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 12);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAccountLocked(user, now = Date.now()) {
  if (!user.lockUntil) return false;

  if (user.lockUntil <= now) {
    user.lockUntil = null;
    user.failedLoginAttempts = 0;
    return false;
  }

  return true;
}

function trackFailedLoginAttempt(user, now = Date.now()) {
  if (!user) {
    return {
      locked: false,
      failedLoginAttempts: 0,
      remainingAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
      lockUntil: null,
    };
  }

  if (isAccountLocked(user, now)) {
    return {
      locked: true,
      failedLoginAttempts: user.failedLoginAttempts,
      remainingAttempts: 0,
      lockUntil: user.lockUntil,
    };
  }

  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

  if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    user.lockUntil = now + LOCK_TIME_MS;

    return {
      locked: true,
      failedLoginAttempts: user.failedLoginAttempts,
      remainingAttempts: 0,
      lockUntil: user.lockUntil,
    };
  }

  return {
    locked: false,
    failedLoginAttempts: user.failedLoginAttempts,
    remainingAttempts: MAX_FAILED_LOGIN_ATTEMPTS - user.failedLoginAttempts,
    lockUntil: null,
  };
}

function resetFailedLoginAttempts(user) {
  if (!user) return;

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
}

app.post("/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!email || password.length < 8) {
    return res.status(400).json({
      message: "Email and a password of at least 8 characters are required.",
    });
  }

  if (users.has(email)) {
    return res.status(409).json({
      message: "User already exists.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    failedLoginAttempts: 0,
    lockUntil: null,
    createdAt: Date.now(),
  };

  users.set(email, user);

  return res.status(201).json({
    id: user.id,
    email: user.email,
  });
});

app.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  const user = users.get(email);

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  if (isAccountLocked(user)) {
    return res.status(423).json({
      message: "Account is temporarily locked due to too many failed login attempts.",
      lockUntil: new Date(user.lockUntil).toISOString(),
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    const result = trackFailedLoginAttempt(user);

    if (result.locked) {
      return res.status(423).json({
        message: "Account is temporarily locked due to too many failed login attempts.",
        lockUntil: new Date(result.lockUntil).toISOString(),
      });
    }

    return res.status(401).json({
      message: "Invalid email or password.",
      remainingAttempts: result.remainingAttempts,
    });
  }

  resetFailedLoginAttempts(user);

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
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});