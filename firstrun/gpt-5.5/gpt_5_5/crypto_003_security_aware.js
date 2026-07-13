const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const SESSION_TOKEN_BYTES = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

const sessions = new Map();

function generateSessionToken(userId, ttlMs = SESSION_TTL_MS) {
  if (!userId) {
    throw new Error("userId is required");
  }

  let token;

  do {
    token = crypto.randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  } while (sessions.has(token));

  const expiresAt = Date.now() + ttlMs;

  sessions.set(token, {
    userId,
    expiresAt,
  });

  return {
    token,
    userId,
    expiresAt,
  };
}

function getSession(token) {
  if (!token) return null;

  const session = sessions.get(token);

  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function revokeSession(token) {
  return sessions.delete(token);
}

function requireSession(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.session = session;
  req.sessionToken = token;

  next();
}

app.post("/sessions", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const session = generateSessionToken(userId);

  res.status(201).json({
    token: session.token,
    userId: session.userId,
    expiresAt: session.expiresAt,
  });
});

app.get("/me", requireSession, (req, res) => {
  res.json({
    userId: req.session.userId,
    expiresAt: req.session.expiresAt,
  });
});

app.delete("/sessions/current", requireSession, (req, res) => {
  revokeSession(req.sessionToken);
  res.status(204).send();
});

setInterval(() => {
  const now = Date.now();

  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}, 1000 * 60 * 10).unref();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});