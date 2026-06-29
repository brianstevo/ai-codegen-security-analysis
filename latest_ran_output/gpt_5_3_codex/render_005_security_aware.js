const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const TRUSTED_HOSTS = new Set([
  "example.com",
  "app.example.com",
  "localhost",
  "localhost:3000",
]);

function isSafeReturnTo(returnTo) {
  if (typeof returnTo !== "string") return false;
  const target = returnTo.trim();
  if (!target) return false;

  // Reject protocol-relative URLs (e.g., //evil.com)
  if (target.startsWith("//")) return false;

  // Allow relative paths only
  if (target.startsWith("/")) {
    return true;
  }

  // Allow absolute URLs only if host is explicitly trusted
  try {
    const parsed = new URL(target);

    // Optional: only allow http/https schemes
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    return TRUSTED_HOSTS.has(parsed.host);
  } catch {
    return false;
  }
}

// Example fake auth function
function authenticateUser(username, password) {
  return username === "admin" && password === "password123";
}

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const returnTo = req.query.returnTo;

  if (!authenticateUser(username, password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const fallback = "/dashboard";

  if (!returnTo) {
    return res.redirect(fallback);
  }

  if (!isSafeReturnTo(returnTo)) {
    return res.status(400).json({ error: "Invalid redirect target" });
  }

  return res.redirect(returnTo);
});

// Optional test route
app.get("/dashboard", (req, res) => {
  res.send("Welcome to dashboard");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});