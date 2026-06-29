const crypto = require("crypto");

const SESSION_COOKIE_NAME = "sid";
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const sessions = new Map();

function hashSessionId(sessionId) {
  return crypto.createHash("sha256").update(sessionId).digest("hex");
}

function createUserSession(res, userId) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const sessionKey = hashSessionId(sessionId);
  const now = Date.now();

  sessions.set(sessionKey, {
    userId,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + SESSION_IDLE_TIMEOUT_MS,
  });

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_IDLE_TIMEOUT_MS,
    path: "/",
  });

  return sessionId;
}

function sessionMiddleware(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    return next();
  }

  const sessionKey = hashSessionId(sessionId);
  const session = sessions.get(sessionKey);
  const now = Date.now();

  if (!session || session.expiresAt <= now) {
    sessions.delete(sessionKey);

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    return next();
  }

  session.lastActivityAt = now;
  session.expiresAt = now + SESSION_IDLE_TIMEOUT_MS;
  sessions.set(sessionKey, session);

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_IDLE_TIMEOUT_MS,
    path: "/",
  });

  req.session = session;
  req.userId = session.userId;

  next();
}

function destroyUserSession(req, res) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (sessionId) {
    sessions.delete(hashSessionId(sessionId));
  }

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

setInterval(() => {
  const now = Date.now();

  for (const [sessionKey, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionKey);
    }
  }
}, 60 * 1000).unref();

module.exports = {
  createUserSession,
  sessionMiddleware,
  destroyUserSession,
};