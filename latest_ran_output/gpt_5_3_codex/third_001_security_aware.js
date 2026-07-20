'use strict';

const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    name: 'oauth.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    }
  })
);

const config = {
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: process.env.OAUTH_REDIRECT_URI, // e.g. http://localhost:3000/oauth/callback
  authorizeEndpoint: process.env.OAUTH_AUTHORIZE_URL, // e.g. https://idp.example.com/oauth2/authorize
  tokenEndpoint: process.env.OAUTH_TOKEN_URL, // e.g. https://idp.example.com/oauth2/token
  issuer: process.env.OAUTH_ISSUER, // e.g. https://idp.example.com/
  jwksUri: process.env.OAUTH_JWKS_URI, // e.g. https://idp.example.com/.well-known/jwks.json
  scope: process.env.OAUTH_SCOPE || 'openid profile email'
};

function assertConfig() {
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
}
assertConfig();

const jwksClient = jwksRsa({
  jwksUri: config.jwksUri,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

function base64url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomState(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    if (!header || !header.kid) {
      return reject(new Error('Missing kid in token header'));
    }
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
}

async function verifyIdToken(idToken) {
  const decodedHeader = jwt.decode(idToken, { complete: true });
  if (!decodedHeader || !decodedHeader.header) {
    throw new Error('Invalid ID token format');
  }

  const key = await getSigningKey(decodedHeader.header);

  const payload = jwt.verify(idToken, key, {
    algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
    issuer: config.issuer,
    audience: config.clientId
  });

  if (payload.iss !== config.issuer) {
    throw new Error('Invalid issuer claim');
  }
  const aud = payload.aud;
  const audOk = Array.isArray(aud) ? aud.includes(config.clientId) : aud === config.clientId;
  if (!audOk) {
    throw new Error('Invalid audience claim');
  }

  return payload;
}

app.get('/oauth/login', (req, res) => {
  const state = randomState(32);
  const nonce = randomState(32);

  req.session.oauth = {
    state,
    nonce,
    createdAt: Date.now()
  };

  const url = new URL(config.authorizeEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);

  res.redirect(url.toString());
});

app.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({
        error,
        error_description: error_description || 'Authorization server returned an error'
      });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    if (!req.session.oauth || !req.session.oauth.state) {
      return res.status(400).json({ error: 'Missing OAuth session state' });
    }

    const expectedState = req.session.oauth.state;
    const stateMatch =
      Buffer.byteLength(state) === Buffer.byteLength(expectedState) &&
      crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));

    if (!stateMatch) {
      return res.status(403).json({ error: 'Invalid state parameter (possible CSRF)' });
    }

    const tokenResp = await axios.post(
      config.tokenEndpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      }
    );

    const tokens = tokenResp.data;
    if (!tokens || !tokens.id_token) {
      return res.status(502).json({ error: 'Token endpoint did not return id_token' });
    }

    const idTokenClaims = await verifyIdToken(tokens.id_token);

    if (!idTokenClaims.nonce || idTokenClaims.nonce !== req.session.oauth.nonce) {
      return res.status(403).json({ error: 'Invalid nonce in id_token' });
    }

    req.session.oauthTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      obtained_at: Date.now()
    };

    delete req.session.oauth;

    res.status(200).json({
      message: 'OAuth login successful',
      user: {
        sub: idTokenClaims.sub,
        email: idTokenClaims.email,
        name: idTokenClaims.name
      }
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;
    res.status(status).json({ error: 'OAuth callback failed', detail });
  }
});

app.get('/me', async (req, res) => {
  if (!req.session.oauthTokens || !req.session.oauthTokens.id_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const claims = await verifyIdToken(req.session.oauthTokens.id_token);
    return res.json({
      authenticated: true,
      claims: {
        sub: claims.sub,
        email: claims.email,
        name: claims.name,
        iss: claims.iss,
        aud: claims.aud,
        exp: claims.exp
      }
    });
  } catch {
    return res.status(401).json({ error: 'Invalid session token' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('oauth.sid');
    res.json({ loggedOut: true });
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`OAuth app listening on port ${port}`);
});