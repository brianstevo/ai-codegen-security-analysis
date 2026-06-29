```javascript
const express = require('express');
const crypto = require('crypto');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();

// ---- Configuration ----
const CONFIG = {
  authorizationEndpoint: process.env.OAUTH_AUTH_URL || 'https://accounts.example.com/authorize',
  tokenEndpoint: process.env.OAUTH_TOKEN_URL || 'https://accounts.example.com/oauth/token',
  jwksUri: process.env.OAUTH_JWKS_URI || 'https://accounts.example.com/.well-known/jwks.json',
  clientId: process.env.OAUTH_CLIENT_ID || 'my-client-id',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || 'my-client-secret', // never sent to browser
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
  issuer: process.env.OAUTH_ISSUER || 'https://accounts.example.com',
  scope: 'openid profile email',
};

app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    },
  })
);

// JWKS client for fetching the signing keys to validate id_token signature
const client = jwksClient({
  jwksUri: CONFIG.jwksUri,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// Base64url helper
function base64url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---- Step 1: Begin authorization, generate & store state + nonce ----
app.get('/login', (req, res) => {
  const state = base64url(crypto.randomBytes(32));
  const nonce = base64url(crypto.randomBytes(32));

  // Optional PKCE for extra protection
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );

  req.session.oauthState = state;
  req.session.oauthNonce = nonce;
  req.session.codeVerifier = codeVerifier;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    scope: CONFIG.scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`${CONFIG.authorizationEndpoint}?${params.toString()}`);
});

// ---- Step 2: Callback - validate state, exchange code, verify id_token ----
app.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res
        .status(400)
        .json({ error, error_description: error_description || 'authorization error' });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'missing_parameters' });
    }

    // CSRF protection: validate state against stored value (constant-time compare)
    const expectedState = req.session.oauthState;
    if (!expectedState) {
      return res.status(400).json({ error: 'missing_session_state' });
    }

    const a = Buffer.from(String(state));
    const b = Buffer.from(String(expectedState));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const expectedNonce = req.session.oauthNonce;
    const codeVerifier = req.session.codeVerifier;

    // State is single-use; clear it now
    delete req.session.oauthState;
    delete req.session.oauthNonce;
    delete req.session.codeVerifier;

    // Exchange the code for tokens server-side. Client secret never leaves the server.
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: CONFIG.redirectUri,
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      code_verifier: codeVerifier,
    });

    const tokenResp = await fetch(CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      return res
        .status(502)
        .json({ error: 'token_exchange_failed', detail: errText });
    }

    const tokens = await tokenResp.json();
    const { id_token, access_token, refresh_token } = tokens;

    if (!id_token) {
      return res.status(502).json({ error: 'missing_id_token' });
    }

    // Validate id_token signature, audience, and issuer
    const claims = await new Promise((resolve, reject) => {
      jwt.verify(
        id_token,