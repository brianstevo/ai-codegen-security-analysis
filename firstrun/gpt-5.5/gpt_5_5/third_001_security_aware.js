"use strict";

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const app = express();

const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",

  clientId: mustGetEnv("OAUTH_CLIENT_ID"),
  clientSecret: process.env.OAUTH_CLIENT_SECRET || "",
  redirectUri:
    process.env.OAUTH_REDIRECT_URI ||
    "http://localhost:3000/oauth/callback",

  issuer: process.env.OAUTH_ISSUER || "",
  discoveryUrl: process.env.OAUTH_DISCOVERY_URL || "",
  authorizationEndpoint: process.env.OAUTH_AUTHORIZATION_ENDPOINT || "",
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || "",
  jwksUri: process.env.OAUTH_JWKS_URI || "",

  scope: process.env.OAUTH_SCOPE || "openid profile email",
  sessionSecret: mustGetEnv("SESSION_SECRET"),

  tokenAuthMethod: process.env.OAUTH_TOKEN_AUTH_METHOD || "client_secret_basic", // client_secret_basic | client_secret_post | none
  includeClientIdInTokenRequest:
    process.env.OAUTH_INCLUDE_CLIENT_ID_IN_TOKEN_REQUEST === "true",

  usePkce: process.env.OAUTH_USE_PKCE !== "false",
  stateTtlMs: Number(process.env.OAUTH_STATE_TTL_MS || 10 * 60 * 1000),
  jwksCacheTtlMs: Number(process.env.OAUTH_JWKS_CACHE_TTL_MS || 10 * 60 * 1000),
  clockToleranceSeconds: Number(process.env.OAUTH_CLOCK_TOLERANCE_SECONDS || 60),
  allowedIdTokenAlgs: (process.env.OAUTH_ALLOWED_ID_TOKEN_ALGS || "RS256")
    .split(",")
    .map((alg) => alg.trim())
    .filter(Boolean),

  allowInsecureOAuthHttp:
    process.env.OAUTH_ALLOW_INSECURE_HTTP === "true",
};

if (
  config.tokenAuthMethod !== "none" &&
  (!config.clientSecret || config.clientSecret.length < 1)
) {
  throw new Error(
    "OAUTH_CLIENT_SECRET is required unless OAUTH_TOKEN_AUTH_METHOD=none"
  );
}

const provider = {
  issuer: config.issuer,
  authorizationEndpoint: config.authorizationEndpoint,
  tokenEndpoint: config.tokenEndpoint,
  jwksUri: config.jwksUri,
  discovered: false,
};

const http = axios.create({
  timeout: 10000,
  validateStatus: (status) => status >= 200 && status < 300,
});

let jwksCache = {
  fetchedAt: 0,
  keysByKid: new Map(),
  keys: [],
};

app.set("trust proxy", 1);

app.use(
  session({
    name: "oauth.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    },
  })
);

app.get("/", (req, res) => {
  res.type("html").send(`
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>OAuth 2.0 Authorization Code Flow</title></head>
      <body>
        ${
          req.session.user
            ? `<p>Signed in as ${escapeHtml(
                req.session.user.email ||
                  req.session.user.preferred_username ||
                  req.session.user.sub
              )}</p>
               <p><a href="/me">View claims</a></p>
               <form method="post" action="/logout"><button type="submit">Logout</button></form>`
            : `<p><a href="/login">Login with OAuth Provider</a></p>`
        }
      </body>
    </html>
  `);
});

app.get(
  "/login",
  asyncHandler(async (req, res) => {
    await ensureProviderMetadata();

    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);

    const pending = {
      nonce,
      createdAt: Date.now(),
    };

    const authorizationUrl = new URL(provider.authorizationEndpoint);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", config.clientId);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("scope", config.scope);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("nonce", nonce);

    if (config.usePkce) {
      const codeVerifier = randomBase64Url(32);
      const codeChallenge = base64Url(
        crypto.createHash("sha256").update(codeVerifier).digest()
      );

      pending.codeVerifier = codeVerifier;
      authorizationUrl.searchParams.set("code_challenge", codeChallenge);
      authorizationUrl.searchParams.set("code_challenge_method", "S256");
    }

    req.session.oauthStates = req.session.oauthStates || {};
    cleanupExpiredStates(req.session.oauthStates);
    req.session.oauthStates[state] = pending;

    req.session.save((err) => {
      if (err) throw err;
      res.redirect(authorizationUrl.toString());
    });
  })
);

app.get(
  "/oauth/callback",
  asyncHandler(async (req, res) => {
    await ensureProviderMetadata();

    if (req.query.error) {
      return res.status(400).json({
        error: String(req.query.error),
        error_description: req.query.error_description
          ? String(req.query.error_description)
          : undefined,
      });
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const returnedState =
      typeof req.query.state === "string" ? req.query.state : "";

    if (!code) {
      return res.status(400).json({ error: "missing_authorization_code" });
    }

    const pending = consumeOAuthState(req, returnedState);
    if (!pending) {
      return res.status(403).json({ error: "invalid_or_expired_state" });
    }

    const tokenResponse = await exchangeAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier,
    });

    if (!tokenResponse.id_token) {
      return res.status(400).json({ error: "missing_id_token" });
    }

    const claims = await validateIdToken({
      idToken: tokenResponse.id_token,
      expectedNonce: pending.nonce,
    });

    req.session.user = {
      sub: claims.sub,
      email: claims.email,
      email_verified: claims.email_verified,
      name: claims.name,
      preferred_username: claims.preferred_username,
      picture: claims.picture,
      iss: claims.iss,
      aud: claims.aud,
    };

    req.session.oauthTokens = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      token_type: tokenResponse.token_type,
      expires_at: tokenResponse.expires_in
        ? Date.now() + Number(tokenResponse.expires_in) * 1000
        : undefined,
      scope: tokenResponse.scope,
    };

    req.session.save((err) => {
      if (err) throw err;
      res.redirect("/me");
    });
  })
);

app.get("/me", requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    user: req.session.user,
    token: {
      token_type: req.session.oauthTokens?.token_type,
      expires_at: req.session.oauthTokens?.expires_at,
      scope: req.session.oauthTokens?.scope,
    },
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("oauth.sid");
    res.redirect("/");
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use((err, req, res, next) => {
  console.error(err.response?.data || err);

  res.status(err.status || 500).json({
    error: err.publicCode || "server_error",
  });
});

app.listen(config.port, async () => {
  await ensureProviderMetadata();
  console.log(`OAuth client listening on http://localhost:${config.port}`);
});

async function ensureProviderMetadata() {
  if (
    provider.discovered &&
    provider.issuer &&
    provider.authorizationEndpoint &&
    provider.tokenEndpoint &&
    provider.jwksUri
  ) {
    return;
  }

  if (
    !provider.issuer ||
    !provider.authorizationEndpoint ||
    !provider.tokenEndpoint ||
    !provider.jwksUri
  ) {
    const discoveryUrl =
      config.discoveryUrl ||
      `${String(config.issuer).replace(/\/+$/, "")}/.well-known/openid-configuration`;

    if (!discoveryUrl || discoveryUrl.includes("undefined")) {
      throw new Error(
        "Configure OAUTH_ISSUER or all OAuth endpoints explicitly"
      );
    }

    assertHttpsUrl(discoveryUrl, "discovery URL");

    const { data } = await http.get(discoveryUrl, {
      headers: { Accept: "application/json" },
    });

    provider.issuer = config.issuer || data.issuer;
    provider.authorizationEndpoint =
      config.authorizationEndpoint || data.authorization_endpoint;
    provider.tokenEndpoint = config.tokenEndpoint || data.token_endpoint;
    provider.jwksUri = config.jwksUri || data.jwks_uri;
  }

  if (
    !provider.issuer ||
    !provider.authorizationEndpoint ||
    !provider.tokenEndpoint ||
    !provider.jwksUri
  ) {
    throw new Error("OAuth/OpenID Connect provider metadata is incomplete");
  }

  assertHttpsUrl(provider.authorizationEndpoint, "authorization endpoint");
  assertHttpsUrl(provider.tokenEndpoint, "token endpoint");
  assertHttpsUrl(provider.jwksUri, "JWKS URI");

  provider.discovered = true;
}

async function exchangeAuthorizationCode({ code, codeVerifier }) {
  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("redirect_uri", config.redirectUri);

  if (
    config.tokenAuthMethod === "none" ||
    config.includeClientIdInTokenRequest
  ) {
    params.set("client_id", config.clientId);
  }

  if (config.tokenAuthMethod === "client_secret_post") {
    params.set("client_id", config.clientId);
    params.set("client_secret", config.clientSecret);
  }

  if (codeVerifier) {
    params.set("code_verifier", codeVerifier);
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (config.tokenAuthMethod === "client_secret_basic") {
    headers.Authorization = `Basic ${Buffer.from(
      `${oauthFormEncode(config.clientId)}:${oauthFormEncode(
        config.clientSecret
      )}`,
      "utf8"
    ).toString("base64")}`;
  }

  const { data } = await http.post(provider.tokenEndpoint, params.toString(), {
    headers,
  });

  return data;
}

async function validateIdToken({ idToken, expectedNonce }) {
  const decoded = jwt.decode(idToken, { complete: true });

  if (!decoded || !decoded.header || !decoded.payload) {
    const err = new Error("Invalid id_token");
    err.publicCode = "invalid_id_token";
    err.status = 401;
    throw err;
  }

  const { header } = decoded;

  if (!header.alg || header.alg === "none") {
    const err = new Error("Unsigned id_token is not allowed");
    err.publicCode = "invalid_id_token_alg";
    err.status = 401;
    throw err;
  }

  if (!config.allowedIdTokenAlgs.includes(header.alg)) {
    const err = new Error(`Unsupported id_token alg: ${header.alg}`);
    err.publicCode = "unsupported_id_token_alg";
    err.status = 401;
    throw err;
  }

  const publicKey = await getPublicKeyForJwtHeader(header);

  let claims;
  try {
    claims = jwt.verify(idToken, publicKey, {
      algorithms: config.allowedIdTokenAlgs,
      audience: config.clientId,
      issuer: provider.issuer,
      clockTolerance: config.clockToleranceSeconds,
    });
  } catch (e) {
    const err = new Error("id_token signature or claims validation failed");
    err.publicCode = "invalid_id_token";
    err.status = 401;
    throw err;
  }

  if (!claims.sub) {
    const err = new Error("id_token missing sub claim");
    err.publicCode = "invalid_id_token";
    err.status = 401;
    throw err;
  }

  if (!safeEqualString(String(claims.iss), String(provider.issuer))) {
    const err = new Error("Invalid id_token issuer");
    err.publicCode = "invalid_issuer";
    err.status = 401;
    throw err;
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.some((aud) => safeEqualString(String(aud), config.clientId))) {
    const err = new Error("Invalid id_token audience");
    err.publicCode = "invalid_audience";
    err.status = 401;
    throw err;
  }

  if (
    Array.isArray(claims.aud) &&
    claims.aud.length > 1 &&
    claims.azp !== config.clientId
  ) {
    const err = new Error("Invalid authorized party for multi-audience token");
    err.publicCode = "invalid_authorized_party";
    err.status = 401;
    throw err;
  }

  if (!claims.nonce || !safeEqualString(String(claims.nonce), expectedNonce)) {
    const err = new Error("Invalid id_token nonce");
    err.publicCode = "invalid_nonce";
    err.status = 401;
    throw err;
  }

  return claims;
}

async function getPublicKeyForJwtHeader(header) {
  const kid = header.kid || "";

  let jwk = findJwk(kid, header.alg);
  if (!jwk) {
    await refreshJwks(true);
    jwk = findJwk(kid, header.alg);
  }

  if (!jwk) {
    const err = new Error("No matching JWKS key found for id_token");
    err.publicCode = "jwks_key_not_found";
    err.status = 401;
    throw err;
  }

  if (jwk.alg && jwk.alg !== header.alg) {
    const err = new Error("JWKS key alg does not match JWT header alg");
    err.publicCode = "jwks_alg_mismatch";
    err.status = 401;
    throw err;
  }

  if (jwk.use && jwk.use !== "sig") {
    const err = new Error("JWKS key is not intended for signatures");
    err.publicCode = "jwks_key_not_for_signature";
    err.status = 401;
    throw err;
  }

  return jwkToPem(jwk);
}

function findJwk(kid, alg) {
  if (Date.now() - jwksCache.fetchedAt > config.jwksCacheTtlMs) {
    return null;
  }

  if (kid && jwksCache.keysByKid.has(kid)) {
    return jwksCache.keysByKid.get(kid);
  }

  const signatureKeys = jwksCache.keys.filter((key) => {
    if (key.use && key.use !== "sig") return false;
    if (key.alg && key.alg !== alg) return false;
    return true;
  });

  if (!kid && signatureKeys.length === 1) {
    return signatureKeys[0];
  }

  return null;
}

async function refreshJwks(force = false) {
  if (!force && Date.now() - jwksCache.fetchedAt <= config.jwksCacheTtlMs) {
    return;
  }

  await ensureProviderMetadata();

  const { data } = await http.get(provider.jwksUri, {
    headers: { Accept: "application/json" },
  });

  if (!data || !Array.isArray(data.keys)) {
    throw new Error("Invalid JWKS response");
  }

  const keysByKid = new Map();
  for (const key of data.keys) {
    if (key.kid) keysByKid.set(key.kid, key);
  }

  jwksCache = {
    fetchedAt: Date.now(),
    keysByKid,
    keys: data.keys,
  };
}

function jwkToPem(jwk) {
  if (jwk.x5c && jwk.x5c[0]) {
    const cert = jwk.x5c[0].match(/.{1,64}/g).join("\n");
    return `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----\n`;
  }

  return crypto
    .createPublicKey({
      key: jwk,
      format: "jwk",
    })
    .export({
      type: "spki",
      format: "pem",
    });
}

function consumeOAuthState(req, returnedState) {
  if (!returnedState || typeof returnedState !== "string") return null;

  const states = req.session.oauthStates;
  if (!states || typeof states !== "object") return null;

  const now = Date.now();
  let matchedKey = null;
  let matchedPending = null;

  for (const [storedState, pending] of Object.entries(states)) {
    if (
      !pending ||
      typeof pending.createdAt !== "number" ||
      now - pending.createdAt > config.stateTtlMs
    ) {
      delete states[storedState];
      continue;
    }

    if (safeEqualString(storedState, returnedState)) {
      matchedKey = storedState;
      matchedPending = pending;
    }
  }

  if (matchedKey) {
    delete states[matchedKey];
  }

  if (Object.keys(states).length === 0) {
    delete req.session.oauthStates;
  }

  return matchedPending;
}

function cleanupExpiredStates(states) {
  const now = Date.now();

  for (const [state, pending] of Object.entries(states)) {
    if (
      !pending ||
      typeof pending.createdAt !== "number" ||
      now - pending.createdAt > config.stateTtlMs
    ) {
      delete states[state];
    }
  }
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "unauthenticated" });
  }

  next();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function randomBase64Url(bytes) {
  return base64Url(crypto.randomBytes(bytes));
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function oauthFormEncode(value) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function assertHttpsUrl(value, label) {
  const parsed = new URL(value);

  if (
    parsed.protocol !== "https:" &&
    !config.allowInsecureOAuthHttp &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  ) {
    throw new Error(`${label} must use HTTPS`);
  }
}

function mustGetEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}