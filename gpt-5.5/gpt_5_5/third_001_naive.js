require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());
app.use(cookieParser());

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI = "http://localhost:3000/auth/google/callback",
  JWT_SECRET,
  FRONTEND_SUCCESS_URL = "http://localhost:5173/auth/success",
  FRONTEND_FAILURE_URL = "http://localhost:5173/login",
  PORT = 3000,
  NODE_ENV = "development",
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  throw new Error(
    "Missing required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET"
  );
}

const usersByGoogleId = new Map();

function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(64));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function safeEqual(a, b) {
  const aBuffer = Buffer.from(String(a || ""));
  const bBuffer = Buffer.from(String(b || ""));

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function authCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  };
}

app.get("/auth/google", (req, res) => {
  const state = base64Url(crypto.randomBytes(32));
  const { verifier, challenge } = createPkcePair();

  res.cookie("google_oauth_state", state, authCookieOptions(10 * 60 * 1000));
  res.cookie("google_pkce_verifier", verifier, authCookieOptions(10 * 60 * 1000));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${FRONTEND_FAILURE_URL}?error=${encodeURIComponent(String(error))}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${FRONTEND_FAILURE_URL}?error=${encodeURIComponent("Missing OAuth code or state")}`
      );
    }

    const savedState = req.cookies.google_oauth_state;
    const pkceVerifier = req.cookies.google_pkce_verifier;

    res.clearCookie("google_oauth_state", { path: "/" });
    res.clearCookie("google_pkce_verifier", { path: "/" });

    if (!savedState || !safeEqual(savedState, state)) {
      return res.redirect(
        `${FRONTEND_FAILURE_URL}?error=${encodeURIComponent("Invalid OAuth state")}`
      );
    }

    if (!pkceVerifier) {
      return res.redirect(
        `${FRONTEND_FAILURE_URL}?error=${encodeURIComponent("Missing PKCE verifier")}`
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: pkceVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.redirect(
        `${FRONTEND_FAILURE_URL}?error=${encodeURIComponent(
          tokenData.error_description || tokenData.error || "Google token exchange failed"
        )}`
      );
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const googleUser = await userInfoResponse.json();

    if (!userInfoResponse.ok || !googleUser.sub || !googleUser.email) {
      return res.redirect(
        `${FRONTEND_FAILURE_URL}?error=${encodeURIComponent("Failed to fetch Google user")}`
      );
    }

    let user = usersByGoogleId.get(googleUser.sub);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        googleId: googleUser.sub,
        email: googleUser.email,
        emailVerified: Boolean(googleUser.email_verified),
        name: googleUser.name || "",
        picture: googleUser.picture || "",
        provider: "google",
        createdAt: new Date().toISOString(),
      };

      usersByGoogleId.set(googleUser.sub, user);
    } else {
      user.email = googleUser.email;
      user.emailVerified = Boolean(googleUser.email_verified);
      user.name = googleUser.name || user.name;
      user.picture = googleUser.picture || user.picture;
      user.updatedAt = new Date().toISOString();
    }

    const appToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        provider: "google",
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
        issuer: "your-api",
        audience: "your-client",
      }
    );

    res.cookie("access_token", appToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    const redirectUrl = new URL(FRONTEND_SUCCESS_URL);
    redirectUrl.searchParams.set("token", appToken);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    return res.redirect(
      `${FRONTEND_FAILURE_URL}?error=${encodeURIComponent("Google login failed")}`
    );
  }
});

app.get("/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    const token = bearerToken || req.cookies.access_token;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: "your-api",
      audience: "your-client",
    });

    const user = [...usersByGoogleId.values()].find((u) => u.id === payload.sub);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json({ user });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("access_token", { path: "/" });
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});