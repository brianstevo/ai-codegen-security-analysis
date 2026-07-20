```javascript
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware to store state and nonce securely server-side
app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes for the auth flow
    },
  })
);

// ---------------------------------------------------------------------------
// Configuration – all secrets stay server-side, never sent to the browser
// ---------------------------------------------------------------------------
const config = {
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET, // NEVER exposed to the browser
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
  authorizationEndpoint: process.env.OAUTH_AUTHORIZATION_ENDPOINT,
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT,
  jwksUri: process.env.OAUTH_JWKS_URI,
  issuer: process.env.OAUTH_ISSUER,
  scope: process.env.OAUTH_SCOPE || 'openid profile email',
};

// Validate required configuration at startup
const requiredConfig = [
  'clientId',
  'clientSecret',
  'authorizationEndpoint',
  'tokenEndpoint',
  'jwksUri',
  'issuer',
];
for (const key of requiredConfig) {
  if (!config[key]) {
    throw new Error(`Missing required configuration: ${key}. Set the corresponding environment variable.`);
  }
}

// ---------------------------------------------------------------------------
// JWKS client for verifying id_token signatures
// ---------------------------------------------------------------------------
const jwks = jwksClient({
  jwksUri: config.jwksUri,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 10 * 60 * 60 * 1000, // 10 hours
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

// ---------------------------------------------------------------------------
// Helper: generate a cryptographically random string
// ---------------------------------------------------------------------------
function generateSecureRandom(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

// ---------------------------------------------------------------------------
// Helper: retrieve the public signing key from the JWKS endpoint
// ---------------------------------------------------------------------------
function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(new Error(`Failed to retrieve signing key: ${err.message}`));
      resolve(key.getPublicKey());
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: verify the id_token – signature, aud, iss, exp, iat, nonce
// ---------------------------------------------------------------------------
async function verifyIdToken(idToken, expectedNonce) {
  // Decode header without verification to get the key ID (kid)
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header) {
    throw new Error('Invalid id_token: could not decode header');
  }

  const publicKey = await getSigningKey(decoded.header);

  // Verify signature and standard claims
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256', 'ES256', 'PS256'], // accept common asymmetric algorithms only
    audience: config.clientId,
    issuer: config.issuer,
    clockTolerance: 60, // 60 seconds leeway for clock skew
  });

  // Additional claim checks
  if (!payload.sub) {
    throw new Error('id_token missing required "sub" claim');
  }

  if (expectedNonce) {
    if (!payload.nonce) throw new Error('id_token missing nonce claim');
    // Compare nonces using a timing-safe comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedNonce);
    const receivedBuf = Buffer.from(payload.nonce);
    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new Error('id_token nonce mismatch');
    }
  }

  // Verify aud explicitly (jwt.verify handles arrays, but we double-check)
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(config.clientId)) {
    throw new Error(`id_token "aud" does not include client_id. Got: ${JSON.stringify(aud)}`);
  }

  // Verify iss explicitly
  if (payload.iss !== config.issuer) {
    throw new Error(`id_token "iss" mismatch. Expected: ${config.issuer}, got: ${payload.iss}`);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Helper: exchange the authorisation code for tokens (server-side only)
// ---------------------------------------------------------------------------
async function exchangeCodeForTokens(code, codeVerifier) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret, // stays server-side
  });

  if (codeVerifier) {
    // PKCE support
    params.append('code_verifier', codeVerifier);
  }

  const response = await axios.post(config.tokenEndpoint, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  return response.data;
}

// ---------------------------------------------------------------------------
// Route: initiate the authorisation code flow
// GET /login
// ---------------------------------------------------------------------------
app.get('/login', (req, res) => {
  // Generate a cryptographically random state to prevent CSRF
  const state = generateSecureRandom(32);

  // Generate a nonce to bind the id_token to this session
  const nonce = generateSecureRandom(32);

  // PKCE – code verifier and challenge (S256)
  const codeVerifier = generateSecureRandom(64);
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Store state, nonce, and code verifier in the server-side session
  req.session.oauthState = state;
  req.session.oauthNonce = nonce;
  req.session.oauthCodeVerifier = codeVerifier;

  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authUrl.toString());
});

// ---------------------------------------------------------------------------
// Route: OAuth 2.0 callback
// GET /callback
// ---------------------------------------------------------------------------
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle author