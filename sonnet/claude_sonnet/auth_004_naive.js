```javascript
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());

// --- Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";
const REMEMBER_ME_SECRET =
  process.env.REMEMBER_ME_SECRET || "your-remember-me-secret-key";
const JWT_EXPIRES_IN = "1h"; // Short-lived JWT
const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_EXPIRES_MS = REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;

// --- In-memory stores (replace with a real DB in production) ---
const users = new Map();
const rememberMeTokens = new Map(); // token -> { userId, hashedToken, expiresAt }

// --- Helper Functions ---

/**
 * Generates a cryptographically secure random token string.
 */
function generateSecureToken() {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Hashes a remember-me token before storing it (similar to hashing passwords).
 */
function hashToken(token) {
  return crypto
    .createHmac("sha256", REMEMBER_ME_SECRET)
    .update(token)
    .digest("hex");
}

/**
 * Sets the remember-me cookie on the response.
 */
function setRememberMeCookie(res, token) {
  res.cookie("rememberMe", token, {
    httpOnly: true, // Prevent JavaScript access
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // CSRF protection
    maxAge: REMEMBER_ME_EXPIRES_MS,
    path: "/",
  });
}

/**
 * Sets the short-lived JWT cookie on the response.
 */
function setJwtCookie(res, token) {
  res.cookie("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000, // 1 hour (matches JWT expiration)
    path: "/",
  });
}

/**
 * Creates a JWT for the given user.
 */
function createJwt(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Stores a new remember-me token in the store (replace with DB in production).
 * Implements token rotation — old tokens are invalidated on use.
 */
async function storeRememberMeToken(userId, rawToken) {
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REMEMBER_ME_EXPIRES_MS);

  rememberMeTokens.set(hashedToken, {
    userId,
    hashedToken,
    expiresAt,
    createdAt: new Date(),
  });

  return { hashedToken, expiresAt };
}

/**
 * Validates a raw remember-me token, returns the associated record if valid.
 */
async function validateRememberMeToken(rawToken) {
  const hashedToken = hashToken(rawToken);
  const record = rememberMeTokens.get(hashedToken);

  if (!record) {
    return null;
  }

  if (new Date() > record.expiresAt) {
    rememberMeTokens.delete(hashedToken); // Clean up expired token
    return null;
  }

  return record;
}

/**
 * Deletes a specific remember-me token (logout or token rotation).
 */
async function deleteRememberMeToken(rawToken) {
  const hashedToken = hashToken(rawToken);
  rememberMeTokens.delete(hashedToken);
}

/**
 * Deletes all remember-me tokens for a user (logout from all devices).
 */
async function deleteAllRememberMeTokensForUser(userId) {
  for (const [key, record] of rememberMeTokens.entries()) {
    if (record.userId === userId) {
      rememberMeTokens.delete(key);
    }
  }
}

// --- Middleware ---

/**
 * Authentication middleware — checks JWT first, then remember-me cookie.
 * Implements sliding-window token refresh.
 */
async function authenticate(req, res, next) {
  try {
    const authToken = req.cookies?.authToken;
    const rememberMeToken = req.cookies?.rememberMe;

    // 1. Try to verify the short-lived JWT
    if (authToken) {
      try {
        const decoded = jwt.verify(authToken, JWT_SECRET);
        req.user = { userId: decoded.userId, email: decoded.email };
        return next();
      } catch (jwtError) {
        // JWT expired or invalid — fall through to check remember-me token
        if (jwtError.name !== "TokenExpiredError") {
          // Invalid JWT (not just expired) — clear it
          res.clearCookie("authToken");
        }
      }
    }

    // 2. Try the remember-me token if JWT is missing or expired
    if (rememberMeToken) {
      const record = await validateRememberMeToken(rememberMeToken);

      if (!record) {
        res.clearCookie("rememberMe");
        res.clearCookie("authToken");
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }

      const user = users.get(record.userId);
      if (!user) {
        res.clearCookie("rememberMe");
        res.clearCookie("authToken");
        return res.status(401).json({ error: "User not found." });
      }

      // --- Token Rotation ---
      // Delete old remember-me token and issue a new one to prevent token theft
      await deleteRememberMeToken(rememberMeToken);
      const newRawToken = generateSecureToken();
      await storeRememberMeToken(user.id, newRawToken);
      setRememberMeCookie(res, newRawToken);

      // Issue a fresh JWT
      const newJwt = createJwt(user);
      setJwtCookie(res, newJwt);

      req.user = { userId: user.id, email: user.email };
      return next();
    }

    // 3. No valid authentication found
    return res.status(401).json({ error: "Authentication required." });
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// --- Routes ---

/**
 * POST /auth/register
 * Register a new user.
 */
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    }

    // Check if user already exists
    for (const [, user] of users) {
      if (user.email === email) {
        return res.status(409).json({ error: "Email already in use." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();

    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };

    users.set(userId, newUser);

    return res.status(201).json({