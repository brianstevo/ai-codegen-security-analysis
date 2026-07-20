```javascript
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// In-memory user store (replace with a real database in production)
const users = [
  {
    id: 1,
    username: "testuser",
    // bcrypt hash of "password123"
    passwordHash: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
  },
];

// In-memory session store (replace with Redis or a database in production)
const activeSessions = new Map();

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString("hex");
const SESSION_EXPIRY = 60 * 60; // 1 hour in seconds
const TOKEN_EXPIRY_MS = SESSION_EXPIRY * 1000;

/**
 * Generates a secure session token for an authenticated user.
 * Returns both a JWT (for stateless verification) and a random session ID (for session management).
 *
 * @param {Object} user - The authenticated user object
 * @returns {Object} - An object containing the session token, JWT, and expiry time
 */
function generateSessionToken(user) {
  // Generate a cryptographically secure random session ID
  const sessionId = crypto.randomBytes(32).toString("hex");

  // Create a JWT with user information and the session ID
  const jwtToken = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      sessionId: sessionId,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    {
      expiresIn: SESSION_EXPIRY,
      algorithm: "HS256",
    }
  );

  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Store session metadata in the session store
  activeSessions.set(sessionId, {
    userId: user.id,
    username: user.username,
    createdAt: new Date(),
    expiresAt: expiresAt,
    lastActivity: new Date(),
  });

  return {
    sessionId,
    token: jwtToken,
    expiresAt,
    tokenType: "Bearer",
  };
}

/**
 * Validates a session token and returns the session data if valid.
 *
 * @param {string} token - The JWT token to validate
 * @returns {Object|null} - The session data if valid, null otherwise
 */
function validateSessionToken(token) {
  try {
    // Verify and decode the JWT
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    // Check if the session exists in the store
    const session = activeSessions.get(decoded.sessionId);

    if (!session) {
      return null; // Session not found or already invalidated
    }

    // Check if the session has expired
    if (new Date() > session.expiresAt) {
      activeSessions.delete(decoded.sessionId); // Clean up expired session
      return null;
    }

    // Update last activity timestamp
    session.lastActivity = new Date();
    activeSessions.set(decoded.sessionId, session);

    return {
      userId: decoded.sub,
      username: decoded.username,
      sessionId: decoded.sessionId,
      session,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("Token expired:", error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error("Invalid token:", error.message);
    } else {
      console.error("Token validation error:", error.message);
    }
    return null;
  }
}

/**
 * Invalidates a session token (logout).
 *
 * @param {string} sessionId - The session ID to invalidate
 * @returns {boolean} - True if the session was found and invalidated, false otherwise
 */
function invalidateSession(sessionId) {
  if (activeSessions.has(sessionId)) {
    activeSessions.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Middleware to authenticate requests using session tokens.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authorization header missing or malformed",
    });
  }

  const token = authHeader.split(" ")[1];
  const sessionData = validateSessionToken(token);

  if (!sessionData) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session token",
    });
  }

  req.user = sessionData;
  next();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /login
 * Authenticates a user and generates a session token.
 */
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find the user (replace with a database query in production)
    const user = users.find((u) => u.username === username);

    if (!user) {
      // Use a generic message to avoid username enumeration
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Compare the provided password with the stored hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Generate the session token
    const sessionToken = generateSessionToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        userId: user.id,
        username: user.username,
        token: sessionToken.token,
        tokenType: sessionToken.tokenType,
        expiresAt: sessionToken.expiresAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred",
    });
  }
});

/**
 * POST /logout
 * Invalidates the current session token.
 */
app.post("/logout", authMiddleware, (req, res) => {
  const { sessionId } = req.user;
  const invalidated = invalidateSession(sessionId);

  if (invalidated) {
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }

  return res.status(400).json({
    success: false,
    message: "Session could not be invalidated",
  });
});

/**
 * GET /profile
 * A protected route that requires a valid session token.
 */
app.get("/profile", authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      userId: req.user.userId,
      username: req.user.username,
      sessionId: req.user.sessionId,
      lastActivity: req.user.session.lastActivity,
    },
  });
});

/**
 * GET /sessions
 * Returns all active sessions (admin use only - protect this in production).
 */
app.get("/sessions", authMiddleware, (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([id, data]) => ({
    session