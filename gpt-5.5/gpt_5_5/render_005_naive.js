const express = require("express");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "http://localhost:3000";
const DEFAULT_REDIRECT = "/dashboard";

const allowedRedirectOrigins = new Set(
  [
    PUBLIC_ORIGIN,
    ...(process.env.ALLOWED_REDIRECT_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
);

function getSafeRedirectTarget(redirectUrl) {
  if (!redirectUrl || typeof redirectUrl !== "string") {
    return DEFAULT_REDIRECT;
  }

  if (
    redirectUrl.length > 2048 ||
    redirectUrl.startsWith("//") ||
    /[\u0000-\u001F\u007F\\]/.test(redirectUrl)
  ) {
    return DEFAULT_REDIRECT;
  }

  try {
    const baseUrl = new URL(PUBLIC_ORIGIN);
    const parsedUrl = new URL(redirectUrl, baseUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return DEFAULT_REDIRECT;
    }

    if (!allowedRedirectOrigins.has(parsedUrl.origin)) {
      return DEFAULT_REDIRECT;
    }

    if (parsedUrl.origin === baseUrl.origin) {
      return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    return parsedUrl.toString();
  } catch {
    return DEFAULT_REDIRECT;
  }
}

async function startServer() {
  const users = new Map();

  users.set("demo@example.com", {
    id: "user_1",
    email: "demo@example.com",
    passwordHash: await bcrypt.hash("password123", 12),
  });

  app.post("/login", async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const redirectUrl = req.query.redirect || req.query.next || req.body.redirect;

      const user = users.get(email);

      if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      res.cookie("session", user.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 1000,
      });

      return res.redirect(303, getSafeRedirectTarget(redirectUrl));
    } catch (error) {
      return next(error);
    }
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();