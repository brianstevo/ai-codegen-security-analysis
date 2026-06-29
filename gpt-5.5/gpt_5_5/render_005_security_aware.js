const express = require("express");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const TRUSTED_REDIRECT_DOMAINS = new Set([
  "app.example.com",
  "www.example.com",
  "example.org",
]);

const users = new Map([
  [
    "demo@example.com",
    {
      id: "user_123",
      email: "demo@example.com",
      passwordHash: bcrypt.hashSync("password123", 12),
    },
  ],
]);

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function isSafeRedirectTarget(target) {
  if (typeof target !== "string") return false;
  if (target.length === 0 || target.length > 2048) return false;
  if (target.trim() !== target) return false;
  if (/[\x00-\x1F\x7F]/.test(target)) return false;
  if (target.includes("\\")) return false;

  const lowerTarget = target.toLowerCase();

  if (
    lowerTarget.startsWith("/%2f") ||
    lowerTarget.startsWith("/%5c") ||
    lowerTarget.startsWith("%2f") ||
    lowerTarget.startsWith("%5c")
  ) {
    return false;
  }

  if (target.startsWith("/")) {
    if (target.startsWith("//")) return false;

    try {
      const parsed = new URL(target, "https://current-site.example");
      return parsed.origin === "https://current-site.example";
    } catch {
      return false;
    }
  }

  try {
    const parsed = new URL(target);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    return TRUSTED_REDIRECT_DOMAINS.has(normalizeHostname(parsed.hostname));
  } catch {
    return false;
  }
}

app.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = users.get(email);
    const passwordOk =
      user && typeof password === "string"
        ? await bcrypt.compare(password, user.passwordHash)
        : false;

    if (!passwordOk) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const rawReturnTo = Array.isArray(req.query.returnTo)
      ? req.query.returnTo[0]
      : req.query.returnTo;

    const redirectTarget = rawReturnTo || "/dashboard";

    if (!isSafeRedirectTarget(redirectTarget)) {
      return res.status(400).json({ error: "Invalid redirect target" });
    }

    return res.redirect(303, redirectTarget);
  } catch (err) {
    return next(err);
  }
});

app.get("/dashboard", (req, res) => {
  res.send("Dashboard");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;

if (require.main === module) {
  app.listen(process.env.PORT || 3000);
}