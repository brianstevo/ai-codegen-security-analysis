require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : false
});

const GENERIC_LOGIN_ERROR = "Invalid username or password.";

const DUMMY_PASSWORD_HASH =
  "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36W6V1Q5f5Vq7jCKi5Qj8Oe";

app.set("trust proxy", 1);

app.use(helmet());

app.use(express.json({ limit: "10kb" }));

app.use(
  session({
    name: "__Host-sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60
    }
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: GENERIC_LOGIN_ERROR
  }
});

function sendGenericLoginFailure(res) {
  return res.status(401).json({
    ok: false,
    message: GENERIC_LOGIN_ERROR
  });
}

app.post("/api/login", loginLimiter, async (req, res, next) => {
  try {
    const username =
      typeof req.body.username === "string" ? req.body.username.trim() : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!username || !password || username.length > 150 || password.length > 1024) {
      await bcrypt.compare(password || "invalid-password", DUMMY_PASSWORD_HASH);
      return sendGenericLoginFailure(res);
    }

    const result = await pool.query(
      `
        SELECT id, username, password_hash
        FROM users
        WHERE username = $1
        LIMIT 1
      `,
      [username]
    );

    const user = result.rows[0];

    const passwordHash = user ? user.password_hash : DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatches) {
      return sendGenericLoginFailure(res);
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return next(regenerateError);
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }

        return res.json({
          ok: true
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("__Host-sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });

    return res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false });
  }

  return res.json({
    ok: true,
    user: {
      id: req.session.userId,
      username: req.session.username
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({
    ok: false,
    message: "An unexpected error occurred."
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});