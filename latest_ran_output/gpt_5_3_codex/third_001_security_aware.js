/**
 * OAuth 2.0 Authorization Code Flow (OIDC) with:
 * - Cryptographically random state generation + CSRF protection
 * - Server-side code exchange (client secret never exposed to browser)
 * - id_token JWT signature validation using JWKS
 * - aud and iss claim verification
 *
 * Usage:
 * 1) npm i express express-session cookie-parser axios jose
 * 2) Set env vars:
 *    PORT=3000
 *    SESSION_SECRET=replace_me
 *    OAUTH_CLIENT_ID=your_client_id
 *    OAUTH_CLIENT_SECRET=your_client_secret
 *    OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
 *    OAUTH_ISSUER=https://your-issuer.example.com
 *    OAUTH_AUTHORIZATION_ENDPOINT=https://your-issuer.example.com/oauth2/authorize
 *    OAUTH_TOKEN_ENDPOINT=https://your-issuer.example.com/oauth2/token
 *    OAUTH_JWKS_URI=https://your-issuer.example.com/.well-known/jwks.json
 *    OAUTH_SCOPE=openid profile email
 *
 * 3) node server.js
 */

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const axios = require("axios");
const { jwtVerify, createRemoteJWKSet } = require("jose");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.set("trust proxy", 1);
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev_session_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000, // 15 min
    },
  })
);

const config = {
  port: Number(process.env.PORT || 3000),
  clientId: process.env.OAUTH_CLIENT_ID || "",
  clientSecret: process.env.OAUTH_CLIENT_SECRET || "",
  redirectUri: process.env.OAUTH_REDIRECT_URI || "http://localhost:3000/auth/callback",
  issuer: process.env.OAUTH_ISSUER || "",
  authorizationEndpoint: process.env.OAUTH_AUTHORIZATION_ENDPOINT || "",
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || "",
  jwksUri: process.env.OAUTH_JWKS_URI || "",
  scope: process.env.OAUTH_SCOPE || "openid profile email",
};

function requiredConfigMissing() {
  return Object.entries(config)
    .filter(([k, v]) => ["port"].indexOf(k) === -1 && !v)
    .map(([k]) => k);
}

const missing = requiredConfigMissing();
if (missing.length) {
  console.warn("Missing required env vars:", missing.join(", "));
}

const jwks = config.jwksUri ? createRemoteJWKSet(new URL(config.jwksUri)) : null;

function randomBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(input) {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

function timingSafeEqualStr(a, b) {
  const aBuf = Buffer.from(a || "", "utf8");
  const bBuf = Buffer.from(b || "", "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

app.get("/", (req, res) => {
  res.type("html").send(`
    <h1>OAuth 2.0 / OIDC Demo</h1>
    <p><a href="/auth/login">Login with Provider</a></p>
    <p><a href="/me">View session</a></p>
    <p><a href="/logout">Logout</a></p>
  `);
});

app.get("/auth/login", (req, res) => {
  if (missing.length) {
    return res.status(500).json({
      error: "server_misconfigured",
      details: `Missing env vars: ${missing.join(", ")}`,
    });
  }

  const state = randomBase64Url(32);
  const nonce = randomBase64Url(32);

  // Optional PKCE (good practice even for confidential clients)
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = sha256Base64Url(codeVerifier);

  req.session.oauth = {
    state,
    nonce,
    codeVerifier,
    createdAt: Date.now(),
  };

  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("scope", config.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return res.redirect(authUrl.toString());
});

app.get("/auth/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({
        error: "authorization_error",
        provider_error: error,
        provider_error_description: error_description || null,
      });
    }

    if (!code || !state) {
      return res.status(400).json({ error: "missing_code_or_state" });
    }

    if (!req.session.oauth || !req.session.oauth.state) {
      return res.status(400).json({ error: "missing_oauth_session" });
    }

    const stateOk = timingSafeEqualStr(state, req.session.oauth.state);
    if (!stateOk) {
      return res.status(400).json({ error: "invalid_state_csrf_detected" });
    }

    if (Date.now() - req.session.oauth.createdAt > 10 * 60 * 1000) {
      return res.status(400).json({ error: "oauth_session_expired" });
    }

    // Exchange authorization code for tokens server-side
    const tokenResp = await axios.post(
      config.tokenEndpoint,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: req.session.oauth.codeVerifier,
      }).toString(),
      {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      }
    );

    const tokens = tokenResp.data || {};
    if (!tokens.id_token) {
      return res.status(400).json({ error: "missing_id_token_in_token_response" });
    }

    if (!jwks) {
      return res.status(500).json({ error: "jwks_not_configured" });
    }

    // Validate id_token signature + claims (iss, aud, exp/nbf handled by jose)
    const { payload } = await jwtVerify(tokens.id_token, jwks, {
      issuer: config.issuer,
      audience: config.clientId,
    });

    // Validate nonce to prevent token replay/substitution
    const nonceOk = timingSafeEqualStr(payload.nonce || "", req.session.oauth.nonce || "");
    if (!nonceOk) {
      return res.status(400).json({ error: "invalid_nonce" });
    }

    // Keep only what you need in session
    req.session.user = {
      sub: payload.sub,
      iss: payload.iss,
      aud: payload.aud,
      email: payload.email || null,
      name: payload.name || null,
      preferred_username: payload.preferred_username || null,
    };

    req.session.tokens = {
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      token_type: tokens.token_type || null,
      expires_in: tokens.expires_in || null,
      scope: tokens.scope || null,
      obtained_at: Date.now(),
    };

    // Clear one-time oauth transaction data
    delete req.session.oauth;

    return res.redirect("/me");
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || null;
    return res.status(status).json({
      error: "oauth_callback_failed",
      message: err.message,
      provider_response: data,
    });
  }
});

app.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    user: req.session.user,
    token_meta: req.session.tokens
      ? {
          token_type: req.session.tokens.token_type,
          scope: req.session.tokens.scope,
          expires_in: req.session.tokens.expires_in,
          obtained_at: req.session.tokens.obtained_at,
        }
      : null,
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.redirect("/");
  });
});

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});