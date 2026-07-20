```javascript
const express = require('express');
const crypto = require('crypto');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();

// ---------------------------------------------------------------------------
// Configuration (in production, load these from environment variables / a vault)
// ---------------------------------------------------------------------------
const CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || 'your-client-secret', // NEVER sent to the browser
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
  authorizationEndpoint: process.env.OAUTH_AUTH_ENDPOINT || 'https://accounts.example.com/oauth2/authorize',
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'https://accounts.example.com/oauth2/token',
  jwksUri: process.env.OAUTH_JWKS_URI || 'https://accounts.example.com/.well-known/jwks.json',
  issuer: process.env.OAUTH_ISSUER || 'https://accounts.example.com',
  scope: 'openid profile email',
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(
  session({
    secret: CONFIG.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // require HTTPS in prod
      maxAge: 10 * 60 * 1000, // 10 minutes for the transient auth state
    },
  })
);

// ---------------------------------------------------------------------------
// JWKS client used to fetch the provider's public signing keys
// ---------------------------------------------------------------------------
const jwks = jwksClient({
  jwksUri: CONFIG.jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// ---------------------------------------------------------------------------
// Helper: base64url-encode a Buffer
// ---------------------------------------------------------------------------
function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Helper: verify an id_token's signature and claims
// ---------------------------------------------------------------------------
function verifyIdToken(idToken, expectedNonce) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getSigningKey,
      {
        algorithms: ['RS256'],
        audience: CONFIG.clientId, // verifies the aud claim
        issuer: CONFIG.issuer,     // verifies the iss claim
        clockTolerance: 5,         // small leeway for clock skew (seconds)
      },
      (err, decoded) => {
        if (err) return reject(err);

        // Verify nonce to bind the token to this login attempt (replay protection)
        if (expectedNonce && decoded.nonce !== expectedNonce) {
          return reject(new Error('Invalid nonce in id_token'));
        }
        resolve(decoded);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Route: start the login by redirecting to the authorization endpoint
// ---------------------------------------------------------------------------
app.get('/login', (req, res) => {
  // Cryptographically random state (CSRF protection) and nonce (replay protection)
  const state = base64url(crypto.randomBytes(32));
  const nonce = base64url(crypto.randomBytes(32));

  // Persist them server-side, tied to the user's session
  req.session.oauthState = state;
  req.session.oauthNonce = nonce;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    scope: CONFIG.scope,
    state,
    nonce,
  });

  res.redirect(`${CONFIG.authorizationEndpoint}?${params.toString()}`);
});

// ---------------------------------------------------------------------------
// Route: OAuth redirect/callback endpoint
// ---------------------------------------------------------------------------
app.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;

    // Provider returned an explicit error
    if (error) {
      return res.status(400).send(`Authorization error: ${error} - ${errorDescription || ''}`);
    }

    // Validate state to prevent CSRF
    const expectedState = req.session.oauthState;
    const expectedNonce = req.session.oauthNonce;

    // Clear one-time-use values immediately
    delete req.session.oauthState;
    delete req.session.oauthNonce;

    if (!state || !expectedState) {
      return res.status(400).send('Missing state parameter');
    }

    const stateBuf = Buffer.from(state);
    const expectedBuf = Buffer.from(expectedState);
    if (
      stateBuf.length !== expectedB