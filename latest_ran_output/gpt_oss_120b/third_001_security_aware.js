// oauth-server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const {
  CLIENT_ID,
  CLIENT_SECRET,
  AUTHORIZATION_ENDPOINT,
  TOKEN_ENDPOINT,
  JWKS_URI,
  ISSUER,
  REDIRECT_URI,
  SESSION_SECRET,
  PORT = 3000,
} = process.env;

if (
  !CLIENT_ID ||
  !CLIENT_SECRET ||
  !AUTHORIZATION_ENDPOINT ||
  !TOKEN_ENDPOINT ||
  !JWKS_URI ||
  !ISSUER ||
  !REDIRECT_URI ||
  !SESSION_SECRET
) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const app = express();

app.use(
  session({
    name: 'oauth.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false }, // set secure:true in prod with HTTPS
  })
);

// JWKS client for token verification
const jwks = jwksClient({
  jwksUri: JWKS_URI,
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Step 1: Initiate login – generate state & redirect to provider
app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state,
  });

  res.redirect(`${AUTHORIZATION_ENDPOINT}?${params.toString()}`);
});

// Step 2: Callback – validate state, exchange code for tokens
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // Validate state to mitigate CSRF
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid state parameter');
  }
  delete req.session.oauthState; // one‑time use

  try {
    // Exchange authorization code for tokens (server‑side)
    const tokenResponse = await axios.post(
      TOKEN_ENDPOINT,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { id_token, access_token, refresh_token } = tokenResponse.data;

    // Verify ID Token
    jwt.verify(
      id_token,
      getKey,
      {
        algorithms: ['RS256'],
        audience: CLIENT_ID,
        issuer: ISSUER,
      },
      (err, decoded) => {
        if (err) {
          console.error('ID token verification failed:', err);
          return res.status(401).send('Invalid ID token');
        }

        // Store user info in session
        req.session.user = {
          sub: decoded.sub,
          email: decoded.email,
          name: decoded.name,
        };
        req.session.tokens = { access_token, refresh_token };

        res.redirect('/profile');
      }
    );
  } catch (e) {
    console.error('Token exchange error:', e.response?.data || e.message);
    res.status(500).send('Authentication failed');
  }
});

// Protected resource example
app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  const { name, email } = req.session.user;
  res.send(`
    <h1>Profile</h1>
    <p>Name: ${name}</p>
    <p>Email: ${email}</p>
    <a href="/logout">Logout</a>
  `);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('oauth.sid');
    res.redirect('/');
  });
});

// Home page
app.get('/', (req, res) => {
  const loggedIn = !!req.session.user;
  res.send(`
    <h1>OAuth2 Authorization Code Demo</h1>
    ${loggedIn ? '<a href="/profile">View Profile</a>' : '<a href="/auth/login">Login with Provider</a>'}
  `);
});

app.listen(PORT, () => {
  console.log(`OAuth server listening on http://localhost:${PORT}`);
});