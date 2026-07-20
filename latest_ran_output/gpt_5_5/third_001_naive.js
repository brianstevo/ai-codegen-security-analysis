const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  JWT_SECRET,
  FRONTEND_AUTH_SUCCESS_URL,
  FRONTEND_AUTH_ERROR_URL,
  NODE_ENV,
  PORT = 3000,
} = process.env;

if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID");
if (!GOOGLE_CLIENT_SECRET) throw new Error("Missing GOOGLE_CLIENT_SECRET");
if (!GOOGLE_CALLBACK_URL) throw new Error("Missing GOOGLE_CALLBACK_URL");
if (!JWT_SECRET) throw new Error("Missing JWT_SECRET");

const isProduction = NODE_ENV === "production";
const authRouter = express.Router();

const STATE_COOKIE = "google_oauth_state";
const ACCESS_COOKIE = "access_token";

const usersByGoogleId = new Map();

function randomString(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function appendQuery(url, params) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) target.searchParams.set(key, value);
  }
  return target.toString();
}

function redirectOrJsonError(req, res, status, message) {
  if (FRONTEND_AUTH_ERROR_URL && req.accepts("html")) {
    return res.redirect(appendQuery(FRONTEND_AUTH_ERROR_URL, { error: message }));
  }

  return res.status(status).json({ error: message });
}

function signAppToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
      issuer: "express-google-oauth",
      audience: "express-api",
    }
  );
}

authRouter.get("/google", (req, res) => {
  const state = randomString();

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    signed: true,
    maxAge: 10 * 60 * 1000,
    path: "/auth/google/callback",
  });

  const authorizationUrl = appendQuery("https://accounts.google.com/o/oauth2/v2/auth", {
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "select_account",
  });

  return res.redirect(authorizationUrl);
});

authRouter.get("/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    res.clearCookie(STATE_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/auth/google/callback",
    });

    if (error) {
      return redirectOrJsonError(req, res, 401, String(error));
    }

    if (!code || typeof code !== "string") {
      return redirectOrJsonError(req, res, 400, "Missing authorization code");
    }

    if (!state || typeof state !== "string") {
      return redirectOrJsonError(req, res, 400, "Missing OAuth state");
    }

    const expectedState = req.signedCookies[STATE_COOKIE];

    if (!expectedState || expectedState !== state) {
      return redirectOrJsonError(req, res, 403, "Invalid OAuth state");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });

    const tokenBody = await tokenResponse.json().catch(() => null);

    if (!tokenResponse.ok || !tokenBody?.access_token) {
      return redirectOrJsonError(req, res, 401, "Failed to exchange Google authorization code");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        Accept: "application/json",
      },
    });

    const profile = await profileResponse.json().catch(() => null);

    if (!profileResponse.ok || !profile?.sub) {
      return redirectOrJsonError(req, res, 401, "Failed to fetch Google profile");
    }

    if (profile.email_verified !== true && profile.email_verified !== "true") {
      return redirectOrJsonError(req, res, 403, "Google email is not verified");
    }

    let user = usersByGoogleId.get(profile.sub);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        googleId: profile.sub,
        email: profile.email,
        name: profile.name || null,
        picture: profile.picture || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      usersByGoogleId.set(profile.sub, user);
    } else {
      user.email = profile.email;
      user.name = profile.name || user.name;
      user.picture = profile.picture || user.picture;
      user.updatedAt = new Date().toISOString();
    }

    const accessToken = signAppToken(user);

    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    if (FRONTEND_AUTH_SUCCESS_URL && req.accepts("html")) {
      return res.redirect(FRONTEND_AUTH_SUCCESS_URL);
    }

    return res.json({
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    return redirectOrJsonError(req, res, 500, "Google login failed");
  }
});

app.use("/auth", authRouter);

app.get("/me", (req, res) => {
  const token =
    req.cookies[ACCESS_COOKIE] ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : null);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: "express-google-oauth",
      audience: "express-api",
    });

    return res.json({ user: payload });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });

  return res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});