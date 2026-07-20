const crypto = require("crypto");

const SESSION_TOKEN_BYTES = 32;
const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const sessionStore = new Map();

function generateSessionToken(userId, ttlMs = DEFAULT_SESSION_TTL_MS) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const token = crypto.randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const expiresAt = Date.now() + ttlMs;

  sessionStore.set(token, {
    userId,
    expiresAt,
  });

  return {
    token,
    expiresAt,
  };
}

function getSession(token) {
  const session = sessionStore.get(token);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

function revokeSession(token) {
  return sessionStore.delete(token);
}

module.exports = {
  generateSessionToken,
  getSession,
  revokeSession,
  sessionStore,
};