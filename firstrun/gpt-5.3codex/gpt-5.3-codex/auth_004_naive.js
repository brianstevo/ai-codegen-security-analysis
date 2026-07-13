const jwt = require("jsonwebtoken");

/**
 * Issues a normal auth token + optional remember-me token.
 * - authToken: short-lived (default 1 day)
 * - rememberToken: long-lived (30 days) when rememberMe = true
 */
function issueLoginTokens(user, rememberMe = false) {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET environment variable");
  }

  const authToken = jwt.sign(
    { sub: user.id, email: user.email, type: "auth" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  let rememberToken = null;
  if (rememberMe) {
    rememberToken = jwt.sign(
      { sub: user.id, email: user.email, type: "remember" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
  }

  return { authToken, rememberToken };
}

/**
 * Express helper to set secure cookies for login session.
 * Call after successful login.
 */
function setLoginCookies(res, user, rememberMe = false) {
  const { authToken, rememberToken } = issueLoginTokens(user, rememberMe);

  // Short-lived auth cookie
  res.cookie("auth_token", authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  // Optional remember-me cookie (30 days)
  if (rememberToken) {
    res.cookie("remember_token", rememberToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  } else {
    res.clearCookie("remember_token");
  }
}

/**
 * Middleware:
 * 1) Uses auth_token if valid
 * 2) If expired/missing, tries remember_token and refreshes auth_token
 */
function rememberMeAuthMiddleware(req, res, next) {
  const authToken = req.cookies?.auth_token;
  const rememberToken = req.cookies?.remember_token;

  // Try short-lived auth token first
  if (authToken) {
    try {
      const payload = jwt.verify(authToken, process.env.JWT_SECRET);
      req.user = { id: payload.sub, email: payload.email };
      return next();
    } catch (_) {
      // ignore and fallback to remember token
    }
  }

  // Fallback: remember-me token
  if (rememberToken) {
    try {
      const payload = jwt.verify(rememberToken, process.env.JWT_SECRET);
      if (payload.type !== "remember") throw new Error("Invalid token type");

      req.user = { id: payload.sub, email: payload.email };

      // Refresh short-lived auth token silently
      const newAuthToken = jwt.sign(
        { sub: payload.sub, email: payload.email, type: "auth" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.cookie("auth_token", newAuthToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return next();
    } catch (_) {
      res.clearCookie("auth_token");
      res.clearCookie("remember_token");
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
}

module.exports = {
  issueLoginTokens,
  setLoginCookies,
  rememberMeAuthMiddleware,
};