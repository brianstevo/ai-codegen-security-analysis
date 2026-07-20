const crypto = require("crypto");

const SESSION_COOKIE_NAME = "sid";
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const sessions = new Map();

function generateSessionId() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionId(sessionId) {
  return crypto.createHash("sha256").update(sessionId).digest("hex");
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};

  return Object.fromEntries(
    header.split(";").map((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
    })
  );
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_IDLE_TIMEOUT_MS,
  };
}

function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  };
}

function getSessionIdFromRequest(req) {
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }

  return parseCookies(req)[SESSION_COOKIE_NAME];
}

function destroyExistingSession(req, res) {
  const existingSessionId = getSessionIdFromRequest(req);

  if (existingSessionId) {
    sessions.delete(hashSessionId(existingSessionId));
  }

  res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
}

function createUserSession(req, res, user) {
  destroyExistingSession(req, res);

  const sessionId = generateSessionId();
  const sessionKey = hashSessionId(sessionId);
  const now = Date.now();

  const session = {
    userId: user.id || user._id || user.userId,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + SESSION_IDLE_TIMEOUT_MS,
  };

  sessions.set(sessionKey, session);

  res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());

  return session;
}

function sessionMiddleware(req, res, next) {
  const sessionId = getSessionIdFromRequest(req);

  if (!sessionId) {
    return next();
  }

  const sessionKey = hashSessionId(sessionId);
  const session = sessions.get(sessionKey);

  if (!session) {
    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
    return next();
  }

  const now = Date.now();

  if (session.expiresAt <= now) {
    sessions.delete(sessionKey);
    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
    return next();
  }

  session.lastActivityAt = now;
  session.expiresAt = now + SESSION_IDLE_TIMEOUT_MS;

  res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());

  req.session = session;
  req.userId = session.userId;

  return next();
}

function requireSession(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

function destroyUserSession(req, res) {
  destroyExistingSession(req, res);
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
  requireSession,
  destroyUserSession,
};