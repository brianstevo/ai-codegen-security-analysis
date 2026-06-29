import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";

const app = express();
app.use(express.json());

// In-memory user storage (replace with database in production)
const users = [];
const sessions = new Map();

// Secret key for JWT (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Generate a session token for a user
 * @param {string} userId - The user ID
 * @param {string} email - The user's email
 * @returns {Object} - Token details including the token and expiry
 */
function generateSessionToken(userId, email) {
  // Generate JWT token
  const token = jwt.sign({ userId, email }, JWT_SECRET, {
    expiresIn: "24h",
    algorithm: "HS256",
  });

  // Generate a session ID for server-side tracking
  const sessionId = crypto.randomBytes(32).toString("hex");

  // Store session metadata
  const sessionData = {
    userId,
    email,
    token,
    sessionId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    lastActivity: new Date(),
  };

  sessions.set(sessionId, sessionData);

  return {
    success: true,
    token,
    sessionId,
    expiresIn: "24h",
    user: { userId, email },
  };
}

/**
 * Verify a session token
 * @param {string} token - The JWT token to verify
 * @returns {Object} - Decoded token data or error
 */
function verifySessionToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, data: decoded };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Invalidate a session (logout)
 * @param {string} sessionId - The session ID to invalidate
 * @returns {boolean} - True if session was invalidated
 */
function invalidateSession(sessionId) {
  return sessions.delete(sessionId);
}

// Routes

/**
 * Register a new user
 */
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    // Check if user already exists
    if (users.some((u) => u.email === email)) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: crypto.randomUUID(),
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };

    users.push(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: user.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Login endpoint
 */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    // Find user
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate session token
    const sessionToken = generateSessionToken(user.id, user.email);

    res.json(sessionToken);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify token endpoint
 */
app.post("/verify-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  const result = verifySessionToken(token);
  res.json(result);
});

/**
 * Logout endpoint
 */
app.post("/logout", (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  const invalidated = invalidateSession(sessionId);

  if (invalidated) {
    res.json({ success: true, message: "Logged out successfully" });
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

/**
 * Get session info endpoint
 */
app.get("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Check if session has expired
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: "Session has expired" });
  }

  // Update last activity
  session.lastActivity = new Date();

  res.json({
    success: true,
    session: {
      sessionId,
      userId: session.userId,
      email: session.email,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastActivity: session.lastActivity,
    },
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Available endpoints:");
  console.log("POST /register - Register a new user");
  console.log("POST /login - Login and get session token");
  console.log("POST /verify-token - Verify a session token");
  console.log("POST /logout - Logout and invalidate session");
  console.log("GET /session/:sessionId - Get session information");
});