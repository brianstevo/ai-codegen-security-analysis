// oauth-server.js
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');

const {
  CLIENT_ID,
  CLIENT_SECRET,
  AUTHORIZATION_ENDPOINT,
  TOKEN_ENDPOINT,
  JWKS_URI,
  ISSUER,
  REDIRECT_URI,
  SCOPES = 'openid profile email',
  SESSION_SECRET = crypto.randomBytes(32).toString('hex')
} = process.env;

if (!CLIENT_ID || !CLIENT_SECRET || !AUTHORIZATION_ENDPOINT || !TOKEN_ENDPOINT || !JWKS_URI || !ISSUER || !REDIRECT_URI) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const app = express();

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

// In‑memory JWKS cache
let jwksCache = null;
let jwksCacheExpiresAt = 0;

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiresAt) return jwksCache;
  const resp = await fetch(JWKS_URI);
  if (!resp.ok) throw new Error('Failed to fetch JWKS');
  const data = await resp.json();
  jwksCache = data.keys;
  // Cache for 1 hour (or respect cache-control headers in a real impl)
  jwksCacheExpiresAt = now + 60 * 60 * 1000;
  return jwksCache;
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Step 1 – redirect user to the authorization server
app.get('/login', (req, res) => {
  const state = generateState();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state
  });

  res.redirect(`${AUTHORIZATION_ENDPOINT}?${params.toString()}`);
});

// Step 2 – callback endpoint to receive authorization code
app.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Validate state parameter
    if (!state || state !== req.session.oauthState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    delete req.session.oauthState; // one‑time use

    // Exchange authorization code for tokens (server‑side)
    const tokenResp = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Use Basic auth as recommended
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      throw new Error(`Token endpoint error: ${err}`);
    }

    const tokenData = await tokenResp.json();
    const { id_token, access_token, refresh_token } = tokenData;

    // Validate ID Token
    const decodedHeader = jwt.decode(id_token, { complete: true });
    if (!decodedHeader) throw new Error('Unable to decode ID token');

    const jwks = await getJwks();
    const key = jwks.find(k => k.kid === decodedHeader.header.kid);
    if (!key) throw new Error('Unable to find matching JWK for kid');

    const publicKey = jwkToPem(key);

    const verifiedIdToken = jwt.verify(id_token, publicKey, {
      algorithms: ['RS256'],
      audience: CLIENT_ID,
      issuer: ISSUER
    });

    // At this point the token is valid – you can extract user info
    req.session.user = {
      sub: verifiedIdToken.sub,
      name: verifiedIdToken.name,
      email: verifiedIdToken.email,
      id_token,
      access_token,
      refresh_token
    };

    res.json({
      message: 'Authentication successful',
      user: req.session.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Example protected route
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthenticated' });
}

app.get('/profile', ensureAuthenticated, async (req, res) => {
  // Optionally fetch userinfo from the provider using access_token
  const { access_token } = req.session.user;
  try {
    const infoResp = await fetch(`${ISSUER}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!infoResp.ok) throw new Error('Failed to fetch userinfo');
    const profile = await infoResp.json();
    res.json({ profile });
  } catch (e) {
    // fallback to token claims
    res.json({ profile: req.session.user });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OAuth server listening on ${PORT}`));