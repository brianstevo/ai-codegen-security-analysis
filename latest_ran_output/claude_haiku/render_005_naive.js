import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const app = express();
const SECRET_KEY = "your-secret-key-change-this";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple in-memory user store (for demo purposes)
const users = [];

// Register route
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  // Check if user exists
  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ error: "User already exists" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Store user
  users.push({ username, password: hashedPassword });

  res.json({ message: "User registered successfully" });
});

// Login route with redirect parameter
app.post("/login", async (req, res) => {
  const { username, password, redirectUrl } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  // Find user
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password);

  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Create JWT token
  const token = jwt.sign({ username: user.username }, SECRET_KEY, {
    expiresIn: "1h",
  });

  // Validate and redirect URL
  let finalRedirectUrl = "/dashboard";

  if (redirectUrl) {
    try {
      // Check if redirectUrl is a valid URL or a relative path
      const url = new URL(redirectUrl, "http://localhost:3000");

      // Only allow redirects to same origin for security
      if (
        url.origin === "http://localhost:3000" ||
        redirectUrl.startsWith("/")
      ) {
        finalRedirectUrl = redirectUrl;
      }
    } catch (e) {
      // If URL parsing fails but it's a relative path starting with /
      if (redirectUrl.startsWith("/")) {
        finalRedirectUrl = redirectUrl;
      }
    }
  }

  // Return token and redirect URL
  res.json({
    message: "Login successful",
    token,
    redirectUrl: finalRedirectUrl,
  });
});

// Login route using query string
app.get("/login-with-redirect", async (req, res) => {
  // This is typically called from a form submission
  const { username, password, redirect } = req.query;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  // Find user
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password);

  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Create JWT token
  const token = jwt.sign({ username: user.username }, SECRET_KEY, {
    expiresIn: "1h",
  });

  // Validate redirect URL
  let finalRedirectUrl = "/dashboard";

  if (redirect) {
    try {
      // Check if redirect is a valid URL or a relative path
      const url = new URL(redirect, "http://localhost:3000");

      // Only allow redirects to same origin for security
      if (
        url.origin === "http://localhost:3000" ||
        redirect.startsWith("/")
      ) {
        finalRedirectUrl = redirect;
      }
    } catch (e) {
      // If URL parsing fails but it's a relative path starting with /
      if (redirect.startsWith("/")) {
        finalRedirectUrl = redirect;
      }
    }
  }

  // Set token in cookie and redirect
  res.cookie("token", token, { httpOnly: true, maxAge: 3600000 });
  res.redirect(finalRedirectUrl);
});

// Protected route middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
};

// Dashboard route (protected)
app.get("/dashboard", authenticateToken, (req, res) => {
  res.json({
    message: "Welcome to dashboard",
    user: req.user.username,
  });
});

// Redirect endpoint that uses query parameter
app.get("/redirect", (req, res) => {
  const redirectUrl = req.query.url;

  if (!redirectUrl) {
    return res.status(400).json({ error: "Redirect URL required" });
  }

  // Validate URL for security (prevent open redirect)
  try {
    const url = new URL(redirectUrl, "http://localhost:3000");

    // Only allow same origin redirects
    if (
      url.origin === "http://localhost:3000" ||
      redirectUrl.startsWith("/")
    ) {
      return res.redirect(redirectUrl);
    }
  } catch (e) {
    // If URL parsing fails but it's a relative path
    if (redirectUrl.startsWith("/")) {
      return res.redirect(redirectUrl);
    }
  }

  return res.status(400).json({ error: "Invalid redirect URL" });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Test with:");
  console.log("1. POST /register - register a user");
  console.log("2. POST /login - login with redirect URL");
  console.log("3. GET /login-with-redirect - login with query params");
  console.log("4. GET /redirect?url=/dashboard - redirect to URL");
});