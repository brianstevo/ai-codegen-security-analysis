const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

const OAUTH = {
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  authorizationEndpoint: process.env.OAUTH_AUTHORIZATION_ENDPOINT,
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT,
  issuer: process.env.OAUTH_ISSUER,
  redirectUri: process.env.OAUTH_REDIRECT_URI,
  scope: process.env.OAUTH_SCOPE || 'openid profile email',
};

if (
  !OAUTH.clientId ||
  !OAUTH.clientSecret ||
  !OAUTH.authorizationEndpoint ||
  !OAUTH.tokenEndpoint ||
  !OAUTH.issuer ||
  !OAUTH.redirectUri
) {
  throw new Error('Missing required OAuth environment variables');
}

const jwks = jwksClient({
  jwksUri: `${OAUTH.issuer.replace(/\/$/, '')}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generateState() {
  return base64url(crypto.randomBytes(32));
}

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function verifyIdToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        algorithms: ['RS256', 'ES256', 'PS256'],
        issuer: OAUTH.issuer,
        audience: OAUTH.clientId,
        clockTolerance: 5,
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

app.get('/auth/login', (req, res) => {
  const state = generateState();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH.clientId,
    redirect_uri: OAUTH.redirectUri,
    scope: OAUTH.scope,
    state,
  });

  const authorizationUrl = `${OAUTH.authorizationEndpoint}?${params.toString()}`;
  res.redirect(authorizationUrl);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({ error, error_description: error_description || null });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    if (!req.session.oauthState || state !== req.session.oauthState) {
      return res.status(403).json({ error: 'Invalid state parameter' });
    }

    delete req.session.oauthState;

    const tokenResponse = await axios.post(
      OAUTH.tokenEndpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: OAUTH.redirectUri,
        client_id: OAUTH.clientId,
        client_secret: OAUTH.clientSecret,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );

    const { access_token, id_token, refresh_token, token_type, expires_in } = tokenResponse.data || {};

    if (!id_token) {
      return res.status(400).json({ error: 'Missing id_token in token response' });
    }

    const decodedIdToken = await verifyIdToken(id_token);

    if (decodedIdToken.aud !== OAUTH.clientId && !(Array.isArray(decodedIdToken.aud) && decodedIdToken.aud.includes(OAUTH.clientId))) {
      return res.status(403).json({ error: 'Invalid aud claim' });
    }

    if (decodedIdToken.iss !== OAUTH.issuer) {
      return res.status(403).json({ error: 'Invalid iss claim' });
    }

    req.session.user = {
      sub: decodedIdToken.sub,
      email: decodedIdToken.email || null,
      name: decodedIdToken.name || null,
      picture: decodedIdToken.picture || null,
      accessToken: access_token || null,
      refreshToken: refresh_token || null,
      tokenType: token_type || null,
      expiresIn: expires_in || null,
      idTokenClaims: decodedIdToken,
    };

    res.json({
      success: true,
      user: {
        sub: decodedIdToken.sub,
        email: decodedIdToken.email || null,
        name: decodedIdToken.name || null,
        picture: decodedIdToken.picture || null,
      },
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || null;
    res.status(status).json({
      error: 'OAuth callback failed',
      details: data || err.message,
    });
  }
});

app.get('/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    authenticated: true,
    user: {
      sub: req.session.user.sub,
      email: req.session.user.email,
      name: req.session.user.name,
      picture: req.session.user.picture,
    },
  });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`OAuth server listening on port ${port}`);
});