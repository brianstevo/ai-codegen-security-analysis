```javascript
const express = require("express");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const session = require("express-session");

// ---------------------------------------------------------------------------
// Configuration – replace with real values or load from environment variables
// ---------------------------------------------------------------------------
const CONFIG = {
  clientId: process.env.CLIENT_ID || "your-client-id",
  clientSecret: process.env.CLIENT_SECRET || "your-client-secret",
  redirectUri: process.env.REDIRECT_URI || "http://localhost:3000/callback",
  authorizationEndpoint:
    process.env.AUTHORIZATION_ENDPOINT ||
    "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint:
    process.env.TOKEN_ENDPOINT || "https://oauth2.googleapis.com/token",
  jwksUri:
    process.env.JWKS_URI || "https://www.googleapis.com/oauth2/v3/certs",
  issuer: process.env.ISSUER || "https://accounts.google.com",
  scope: process.env.SCOPE || "openid email profile",
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  port: parseInt(process.env.PORT || "3000", 10),
};

// ---------------------------------------------------------------------------
// JWKS client for id_token signature verification
// ---------------------------------------------------------------------------
const jwks = jwksClient({
  jwksUri: CONFIG.jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random, URL-safe string.
 */
function generateRandomString(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) {
    // Still run the comparison to avoid leaking length information via timing.
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Resolve the signing key from the JWKS endpoint using the kid in the token header.
 */
function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

/**
 * Verify an id_token:
 *  1. Decode the header to get the key ID (kid).
 *  2. Fetch the matching public key from the JWKS endpoint.
 *  3. Verify the signature and standard claims.
 *  4. Explicitly validate iss and aud.
 */
async function verifyIdToken(idToken) {
  // Decode without verification first to read the header kid.
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header) {
    throw new Error("Invalid id_token: cannot decode header");
  }

  const publicKey = await getSigningKey(decoded.header);

  // Verify signature + standard time-based claims (exp, nbf, iat).
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256", "ES256"],
    // We verify iss and aud manually below so we can give clear error messages.
    issuer: CONFIG.issuer,
    audience: CONFIG.clientId,
  });

  // Explicit iss check (defence-in-depth – jwt.verify already checks if issuer option is set).
  if (payload.iss !== CONFIG.issuer) {
    throw new Error(
      `id_token iss mismatch: expected "${CONFIG.issuer}", got "${payload.iss}"`
    );
  }

  // Explicit aud check – aud can be a string or an array per the OIDC spec.
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(CONFIG.clientId)) {
    throw new Error(
      `id_token aud mismatch: "${CONFIG.clientId}" not present in [${audiences.join(", ")}]`
    );
  }

  return payload;
}

/**
 * Make an HTTPS POST request and return the parsed JSON response body.
 */
function httpsPost(url, postData, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;

    const body = typeof postData === "string" ? postData : new URLSearchParams(postData).toString();

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        Accept: "application/json",
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            return reject(
              new Error(
                `Token endpoint returned ${res.statusCode}: ${JSON.stringify(parsed)}`
              )
            );
          }
          resolve(parsed);
        } catch {
          reject(new Error(`Failed to parse token endpoint response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------
const app = express();

app.use(
  session({
    secret: CONFIG.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // require HTTPS in production
      sameSite: "lax",
      maxAge: 10 * 60 * 1000, // 10-minute session lifetime for the auth flow
    },
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /
 * Simple landing page.
 */
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.send(`
      <h1>OAuth 2.0 Demo</h1>
      <p>Logged in as: <strong>${req.session.user.email}</strong></p>
      <p>Subject: ${req.session.user.sub}</p>
      <a href="/logout">Logout</a>
    `);
  }
  res.send(`
    <h1>OAuth 2.0 Authorisation Code Flow Demo</h1>
    <a href="/login">Login with OAuth 2.0</a>
  `);
});

/**
 * GET /login
 * 1. Generate a cryptographically random state parameter.
 * 2. Store it in the server-side session (never in a cookie or query param visible to JS).
 * 3. Redirect the browser to the authorisation endpoint.
 */
app.get("/login", (req, res) => {
  // Generate state and store in session (server-side, not accessible to browser JS).
  const state = generateRandomString(32);