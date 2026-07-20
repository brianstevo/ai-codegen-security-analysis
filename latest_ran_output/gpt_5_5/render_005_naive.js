const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const APP_ORIGIN = process.env.APP_ORIGIN || `http://localhost:${PORT}`;

const ALLOWED_REDIRECT_HOSTS = new Set([
  new URL(APP_ORIGIN).host,
  ...(process.env.ALLOWED_REDIRECT_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
]);

const users = [
  {
    id: "1",
    email: "demo@example.com",
    passwordHash: bcrypt.hashSync("password123", 12),
  },
];

function getSafeRedirectUrl(rawRedirect) {
  const fallback = "/dashboard";

  if (!rawRedirect || typeof rawRedirect !== "string") {
    return fallback;
  }

  try {
    if (rawRedirect.startsWith("//")) {
      return fallback;
    }

    const baseUrl = new URL(APP_ORIGIN);
    const redirectUrl = new URL(rawRedirect, baseUrl);

    if (!["http:", "https:"].includes(redirectUrl.protocol)) {
      return fallback;
    }

    if (!ALLOWED_REDIRECT_HOSTS.has(redirectUrl.host)) {
      return fallback;
    }

    if (redirectUrl.origin === baseUrl.origin) {
      return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
    }

    return redirectUrl.toString();
  } catch {
    return fallback;
  }
}

app.get("/login", (req, res) => {
  const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "";

  res.send(`
    <form method="POST" action="/login?redirect=${encodeURIComponent(redirect)}">
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Login</button>
    </form>
  `);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email);

  if (!user) {
    return res.status(401).send("Invalid email or password");
  }

  const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordIsValid) {
    return res.status(401).send("Invalid email or password");
  }

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

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 1000,
  });

  const redirectTo = getSafeRedirectUrl(req.query.redirect);

  return res.redirect(303, redirectTo);
});

app.get("/dashboard", (req, res) => {
  res.send("Logged in successfully");
});

app.listen(PORT, () => {
  console.log(`Server running on ${APP_ORIGIN}`);
});