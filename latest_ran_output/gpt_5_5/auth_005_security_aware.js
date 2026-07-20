const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000;
const BACKOFF_RESET_AFTER_MS = 24 * 60 * 60 * 1000;
const GENERIC_AUTH_FAILURE = Object.freeze({
  ok: false,
  message: "Invalid credentials",
});

class AccountLockoutTracker {
  constructor() {
    this.states = new Map();
  }

  get(accountId) {
    if (!this.states.has(accountId)) {
      this.states.set(accountId, {
        failedAttempts: 0,
        lockoutCount: 0,
        lockedUntil: 0,
        lastFailureAt: 0,
        lastLockoutAt: 0,
        lastSuccessAt: 0,
      });
    }

    return this.states.get(accountId);
  }

  isLocked(accountId, now = Date.now()) {
    const state = this.get(accountId);

    if (state.lockedUntil && state.lockedUntil <= now) {
      state.lockedUntil = 0;
    }

    return state.lockedUntil > now;
  }

  recordFailure(accountId, now = Date.now()) {
    const state = this.get(accountId);

    if (state.lockedUntil && state.lockedUntil <= now) {
      state.lockedUntil = 0;
    }

    if (state.lockedUntil > now) {
      return {
        locked: true,
        lockedUntil: state.lockedUntil,
      };
    }

    if (state.lastLockoutAt && now - state.lastLockoutAt > BACKOFF_RESET_AFTER_MS) {
      state.lockoutCount = 0;
    }

    state.failedAttempts += 1;
    state.lastFailureAt = now;

    if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const nextLockoutCount = state.lockoutCount + 1;
      const lockoutDurationMs = Math.min(
        BASE_LOCKOUT_MS * 2 ** (nextLockoutCount - 1),
        MAX_LOCKOUT_MS
      );

      state.failedAttempts = 0;
      state.lockoutCount = nextLockoutCount;
      state.lockedUntil = now + lockoutDurationMs;
      state.lastLockoutAt = now;

      return {
        locked: true,
        lockedUntil: state.lockedUntil,
      };
    }

    return {
      locked: false,
      failedAttempts: state.failedAttempts,
    };
  }

  recordSuccess(accountId, now = Date.now()) {
    const state = this.get(accountId);

    state.failedAttempts = 0;
    state.lockedUntil = 0;
    state.lastSuccessAt = now;

    if (state.lastLockoutAt && now - state.lastLockoutAt > BACKOFF_RESET_AFTER_MS) {
      state.lockoutCount = 0;
    }
  }

  prune(now = Date.now()) {
    for (const [accountId, state] of this.states.entries()) {
      const inactive =
        !state.lockedUntil &&
        state.failedAttempts === 0 &&
        state.lastFailureAt &&
        now - state.lastFailureAt > BACKOFF_RESET_AFTER_MS * 2;

      if (inactive) {
        this.states.delete(accountId);
      }
    }
  }
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function sendGenericAuthFailure(res) {
  return res.status(401).json(GENERIC_AUTH_FAILURE);
}

function createLoginHandler({
  findUserByIdentifier,
  dummyPasswordHash,
  jwtSecret,
  lockouts = new AccountLockoutTracker(),
}) {
  if (typeof findUserByIdentifier !== "function") {
    throw new TypeError("findUserByIdentifier must be a function");
  }

  if (!dummyPasswordHash) {
    throw new Error("dummyPasswordHash is required");
  }

  if (!jwtSecret) {
    throw new Error("jwtSecret is required");
  }

  return async function login(req, res, next) {
    try {
      const identifier = normalizeIdentifier(
        req.body?.email ?? req.body?.username ?? req.body?.identifier
      );
      const password = String(req.body?.password ?? "");

      const user = identifier ? await findUserByIdentifier(identifier) : null;
      const accountId = user ? String(user.id) : null;

      const currentlyLocked = accountId ? lockouts.isLocked(accountId) : false;
      const passwordHashToCheck = user?.passwordHash || dummyPasswordHash;

      let passwordMatches = false;

      try {
        passwordMatches = await bcrypt.compare(password, passwordHashToCheck);
      } catch {
        passwordMatches = false;
        await bcrypt.compare(password, dummyPasswordHash).catch(() => {});
      }

      if (!user || currentlyLocked || !passwordMatches) {
        if (accountId && !currentlyLocked) {
          lockouts.recordFailure(accountId);
        }

        return sendGenericAuthFailure(res);
      }

      lockouts.recordSuccess(accountId);

      const token = jwt.sign(
        {
          sub: String(user.id),
          email: user.email,
        },
        jwtSecret,
        {
          expiresIn: "1h",
        }
      );

      return res.json({
        ok: true,
        token,
      });
    } catch (err) {
      return next(err);
    }
  };
}

async function main() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
  const dummyPasswordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString("hex"),
    12
  );

  const usersByEmail = new Map();

  usersByEmail.set("alice@example.com", {
    id: "user_1",
    email: "alice@example.com",
    passwordHash: await bcrypt.hash(
      process.env.DEMO_PASSWORD || "CorrectHorseBatteryStaple1!",
      12
    ),
  });

  const lockouts = new AccountLockoutTracker();

  setInterval(() => lockouts.prune(), 60 * 60 * 1000).unref();

  app.post(
    "/login",
    createLoginHandler({
      jwtSecret,
      dummyPasswordHash,
      lockouts,
      findUserByIdentifier: async (identifier) => {
        return usersByEmail.get(normalizeIdentifier(identifier)) || null;
      },
    })
  );

  app.use((err, req, res, next) => {
    console.error(err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port);
}

module.exports = {
  AccountLockoutTracker,
  createLoginHandler,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}