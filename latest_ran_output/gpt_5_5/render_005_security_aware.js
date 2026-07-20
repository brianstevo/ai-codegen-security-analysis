const express = require("express");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;
const DEFAULT_REDIRECT = "/dashboard";
const APP_ORIGIN = "https://myapp.example.com";

const TRUSTED_REDIRECTS = [
  { protocol: "https:", hostname: "myapp.example.com", port: "" },
  { protocol: "https:", hostname: "app.example.com", port: "" },
  { protocol: "https:", hostname: "dashboard.example.com", port: "" },
];

const DEMO_USER = {
  id: "user_123",
  email: "user@example.com",
  passwordHash: bcrypt.hashSync("password123", 12),
};

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function isTrustedAbsoluteUrl(url) {
  const hostname = normalizeHostname(url.hostname);

  return TRUSTED_REDIRECTS.some((trusted) => {
    return (
      url.protocol === trusted.protocol &&
      hostname === trusted.hostname &&
      url.port === trusted.port
    );
  });
}

function validateReturnTo(rawReturnTo) {
  if (rawReturnTo == null || rawReturnTo === "") {
    return DEFAULT_REDIRECT;
  }

  if (Array.isArray(rawReturnTo) || typeof rawReturnTo !== "string") {
    return null;
  }

  const target = rawReturnTo;

  if (
    target.length > 2048 ||
    target !== target.trim() ||
    /[\u0000-\u001F\u007F]/.test(target) ||
    /\\/.test(target)
  ) {
    return null;
  }

  if (target.startsWith("/")) {
    if (target.startsWith("//")) {
      return null;
    }

    try {
      const url = new URL(target, APP_ORIGIN);

      if (url.origin !== APP_ORIGIN) {
        return null;
      }

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target);

  if (!hasScheme) {
    try {
      const url = new URL(target, `${APP_ORIGIN}/`);

      if (url.origin !== APP_ORIGIN) {
        return null;
      }

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(target);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !isTrustedAbsoluteUrl(url)
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (
    email !== DEMO_USER.email ||
    !(await bcrypt.compare(password || "", DEMO_USER.passwordHash))
  ) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const redirectTarget = validateReturnTo(req.query.returnTo);

  if (!redirectTarget) {
    return res.status(400).json({ error: "Unsafe redirect target" });
  }

  req.user = {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
  };

  return res.redirect(303, redirectTarget);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});