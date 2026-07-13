const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");

const REMEMBER_COOKIE_NAME = "remember_me";
const REMEMBER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REMEMBER_TOKEN_BYTES = 32;

const REMEMBER_TOKEN_SECRET =
  process.env.REMEMBER_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

function generateToken() {
  return crypto.randomBytes(REMEMBER_TOKEN_BYTES).toString("base64url");
}

function hashToken(token) {
  return crypto
    .createHmac("sha256", REMEMBER_TOKEN_SECRET)
    .update(token, "utf8")
    .digest("hex");
}

function rememberCookieOptions(maxAge = REMEMBER_MAX_AGE_MS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge,
  };
}

class InMemoryRememberMeStore {
  constructor() {
    this.tokensByHash = new Map();
    this.tokenHashByUserId = new Map();
  }

  async save(userId, tokenHash, expiresAt) {
    userId = String(userId);

    const existingHash = this.tokenHashByUserId.get(userId);
    if (existingHash) {
      this.tokensByHash.delete(existingHash);
    }

    const record = {
      userId,
      tokenHash,
      expiresAt: expiresAt instanceof Date ? expiresAt.getTime() : expiresAt,
      createdAt: Date.now(),
    };

    this.tokensByHash.set(tokenHash, record);
    this.tokenHashByUserId.set(userId, tokenHash);

    return record;
  }

  async findByTokenHash(tokenHash) {
    return this.tokensByHash.get(tokenHash) || null;
  }

  async deleteByTokenHash(tokenHash) {
    const record = this.tokensByHash.get(tokenHash);

    if (record) {
      this.tokensByHash.delete(tokenHash);

      if (this.tokenHashByUserId.get(record.userId) === tokenHash) {
        this.tokenHashByUserId.delete(record.userId);
      }
    }
  }

  async deleteByUserId(userId) {
    userId = String(userId);

    const tokenHash = this.tokenHashByUserId.get(userId);

    if (tokenHash) {
      this.tokensByHash.delete(tokenHash);
      this.tokenHashByUserId.delete(userId);
    }
  }

  async replaceToken(oldTokenHash, userId, newTokenHash, newExpiresAt) {
    userId = String(userId);

    const existing = this.tokensByHash.get(oldTokenHash);

    if (!existing || existing.userId !== userId) {
      return false;
    }

    this.tokensByHash.delete(oldTokenHash);
    this.tokenHashByUserId.delete(userId);

    await this.save(userId, newTokenHash, newExpiresAt);

    return true;
  }
}

function createRememberMeFeature({
  store = new InMemoryRememberMeStore(),
  cookieName = REMEMBER_COOKIE_NAME,
  maxAgeMs = REMEMBER_MAX_AGE_MS,
  getUserById,
} = {}) {
  if (typeof getUserById !== "function") {
    throw new Error("getUserById must be provided");
  }

  function setCookie(res, token) {
    res.cookie(cookieName, token, rememberCookieOptions(maxAgeMs));
  }

  function clearCookie(res) {
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
  }

  async function issueRememberMe(res, userId) {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + maxAgeMs;

    await store.save(userId, tokenHash, expiresAt);
    setCookie(res, token);

    return token;
  }

  async function revokeRememberMe(res, userId) {
    if (userId !== undefined && userId !== null) {
      await store.deleteByUserId(userId);
    }

    clearCookie(res);
  }

  async function authenticateAndRotate(req, res) {
    const token = req.cookies?.[cookieName];

    if (!token || typeof token !== "string") {
      return null;
    }

    const oldTokenHash = hashToken(token);
    const record = await store.findByTokenHash(oldTokenHash);

    if (!record) {
      clearCookie(res);
      return null;
    }

    if (record.expiresAt <= Date.now()) {
      await store.deleteByTokenHash(oldTokenHash);
      clearCookie(res);
      return null;
    }

    const user = await getUserById(record.userId);

    if (!user) {
      await store.deleteByTokenHash(oldTokenHash);
      clearCookie(res);
      return null;
    }

    const newToken = generateToken();
    const newTokenHash = hashToken(newToken);
    const newExpiresAt = Date.now() + maxAgeMs;

    const rotated = await store.replaceToken(
      oldTokenHash,
      record.userId,
      newTokenHash,
      newExpiresAt
    );

    if (!rotated) {
      clearCookie(res);
      return null;
    }

    setCookie(res, newToken);

    return user;
  }

  async function rememberMeMiddleware(req, res, next) {
    try {
      if (req.user) {
        return next();
      }

      const user = await authenticateAndRotate(req, res);

      if (user) {
        req.user = user;
      }

      return next();
    } catch (err) {
      return next(err);
    }
  }

  return {
    issueRememberMe,
    revokeRememberMe,
    authenticateAndRotate,
    rememberMeMiddleware,
    store,
  };
}

const app = express();

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

const users = new Map([
  [
    "1",
    {
      id: "1",
      email: "user@example.com",
      passwordHash:
        "$2b$12$gHwJ7UYQ2dmpQITbEoAqTeJyuhBWmXzEWgdNnXmEvrBeEezv9P/iS",
    },
  ],
]);

const rememberMe = createRememberMeFeature({
  getUserById: async (userId) => {
    const user = users.get(String(userId));

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
    };
  },
});

app.use(rememberMe.rememberMeMiddleware);

app.post("/login", async (req, res, next) => {
  try {
    const { email, rememberMe: shouldRemember } = req.body;

    const user = [...users.values()].find((u) => u.email === email);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (shouldRemember) {
      await rememberMe.issueRememberMe(res, user.id);
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    return next(err);
  }
});

app.post("/logout", async (req, res, next) => {
  try {
    await rememberMe.revokeRememberMe(res, req.user?.id);
    return res.sendStatus(204);
  } catch (err) {
    return next(err);
  }
});

app.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({ user: req.user });
});

module.exports = {
  createRememberMeFeature,
  InMemoryRememberMeStore,
  rememberMe,
  app,
};