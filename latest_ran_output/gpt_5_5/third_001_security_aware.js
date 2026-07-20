'use strict';

const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

const REQUIRED_ENV = [
  'OAUTH_ISSUER',
  'OAUTH_CLIENT_ID',
  'OAUTH_CLIENT_SECRET',
  'SESSION_SECRET',
];

for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const CONFIG = {
  port: Number(process.env.PORT || 3000),
  issuer: process.env.OAUTH_ISSUER.replace(/\/+$/, ''),
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri:
    process.env.OAUTH_REDIRECT_URI ||
    `http://localhost:${process.env.PORT || 3000}/oauth/callback`,
  scopes: process.env.OAUTH_SCOPES || 'openid profile email',
  sessionSecret: process.env.SESSION_SECRET,
  tokenEndpointAuthMethod:
    process.env.OAUTH_TOKEN_ENDPOINT_AUTH_METHOD || 'client_secret_basic',
  stateTtlMs: Number(process.env.OAUTH_STATE_TTL_MS || 10 * 60 * 1000),
};

let provider;
let jwks;
let jwtVerify;
let createRemoteJWKSet;

app.set('trust proxy', 1);

app.use(
  session({
    name: 'sid',
    secret: CONFIG.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000,
    },
  })
);

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function randomBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256Base64Url(input) {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function discoverProvider() {
  const discoveryUrl =
    process.env.OAUTH_DISCOVERY_URL ||
    `${CONFIG.issuer}/.well-known/openid-configuration`;

  const response = await fetch(discoveryUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OIDC discovery failed with HTTP ${response.status}`);
  }

  const metadata = await response.json();

  const requiredMetadata = [
    'issuer',
    'authorization_endpoint',
    'token_endpoint',
    'jwks_uri',
  ];

  for (const key of requiredMetadata) {
    if (!metadata[key]) {
      throw new Error(`OIDC discovery response missing ${key}`);
    }
  }

  if (metadata.issuer !== CONFIG.issuer) {
    throw new Error(
      `Issuer mismatch. Configured "${CONFIG.issuer}", discovered "${metadata.issuer}"`
    );
  }

  return metadata;
}

function buildAuthorizationUrl({ state, nonce, codeChallenge }) {
  const url = new URL(provider.authorization_endpoint);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CONFIG.clientId);
  url.searchParams.set('redirect_uri', CONFIG.redirectUri);
  url.searchParams.set('scope', CONFIG.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return url.toString();
}

async function exchangeAuthorizationCode({ code, codeVerifier }) {
  const body = new URLSearchParams();

  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', CONFIG.redirectUri);

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (CONFIG.tokenEndpointAuthMethod === 'client_secret_basic') {
    headers.Authorization =
      'Basic ' +
      Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString(
        'base64'
      );
  } else if (CONFIG.tokenEndpointAuthMethod === 'client_secret_post') {
    body.set('client_id', CONFIG.clientId);
    body.set('client_secret', CONFIG.clientSecret);
  } else if (CONFIG.tokenEndpointAuthMethod === 'none') {
    body.set('client_id', CONFIG.clientId);
  } else {
    throw new Error(
      `Unsupported token endpoint auth method: ${CONFIG.tokenEndpointAuthMethod}`
    );
  }

  body.set('code_verifier', codeVerifier);

  const response = await fetch(provider.token_endpoint, {
    method: 'POST',
    headers,
    body,
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Token endpoint returned non-JSON response');
  }

  if (!response.ok) {
    throw new Error(
      `Token endpoint failed with HTTP ${response.status}: ${
        json.error || 'unknown_error'
      }`
    );
  }

  if (!json.id_token) {
    throw new Error('Token response did not include id_token');
  }

  return json;
}

async function validateIdToken(idToken, expectedNonce) {
  const { payload, protectedHeader } = await jwtVerify(idToken, jwks, {
    issuer: CONFIG.issuer,
    audience: CONFIG.clientId,
    algorithms: [
      'RS256',
      'RS384',
      'RS512',
      'PS256',
      'PS384',
      'PS512',
      'ES256',
      'ES384',
      'ES512',
    ],
  });

  if (!protectedHeader.alg || protectedHeader.alg === 'none') {
    throw new Error('Invalid id_token alg');
  }

  if (payload.iss !== CONFIG.issuer) {
    throw new Error('Invalid id_token iss claim');
  }

  const audienceValid =
    payload.aud === CONFIG.clientId ||
    (Array.isArray(payload.aud) && payload.aud.includes(CONFIG.clientId));

  if (!audienceValid) {
    throw new Error('Invalid id_token aud claim');
  }

  if (Array.isArray(payload.aud) && payload.aud.length > 1) {
    if (payload.azp !== CONFIG.clientId) {
      throw new Error('Invalid id_token azp claim');
    }
  }

  if (!timingSafeEqualString(payload.nonce, expectedNonce)) {
    throw new Error('Invalid id_token nonce claim');
  }

  return payload;
}

app.get(
  '/',
  asyncHandler(async (req, res) => {
    res.type('html').send(`
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
                 <p><a href="/profile">Profile</a></p>
                 <form method="post" action="/logout"><button>Logout</button></form>`
              : `<p><a href="/login">Login with OAuth Provider</a></p>`
          }
        </body>
      </html>
    `);
  })
);

app.get(
  '/login',
  asyncHandler(async (req, res) => {
    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);
    const codeVerifier = randomBase64Url(32);
    const codeChallenge = sha256Base64Url(codeVerifier);

    req.session.oauth = {
      state,
      nonce,
      codeVerifier,
      createdAt: Date.now(),
    };

    await saveSession(req);

    res.redirect(
      buildAuthorizationUrl({
        state,
        nonce,
        codeChallenge,
      })
    );
  })
);

app.get(
  '/oauth/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({
        error: String(error),
        error_description: error_description
          ? String(error_description)
          : undefined,
      });
    }

    if (typeof code !== 'string' || !code) {
      return res.status(400).json({ error: 'missing_authorization_code' });
    }

    if (typeof state !== 'string' || !state) {
      return res.status(400).json({ error: 'missing_state' });
    }

    const stored = req.session.oauth;

    if (
      !stored ||
      !stored.state ||
      !stored.nonce ||
      !stored.codeVerifier ||
      !stored.createdAt
    ) {
      return res.status(400).json({ error: 'missing_stored_oauth_state' });
    }

    const stateExpired = Date.now() - stored.createdAt > CONFIG.stateTtlMs;

    if (stateExpired) {
      delete req.session.oauth;
      await saveSession(req);
      return res.status(400).json({ error: 'expired_state' });
    }

    if (!timingSafeEqualString(state, stored.state)) {
      delete req.session.oauth;
      await saveSession(req);
      return res.status(400).json({ error: 'invalid_state' });
    }

    delete req.session.oauth;

    const tokenSet = await exchangeAuthorizationCode({
      code,
      codeVerifier: stored.codeVerifier,
    });

    const claims = await validateIdToken(tokenSet.id_token, stored.nonce);

    req.session.user = {
      sub: claims.sub,
      name: claims.name,
      email: claims.email,
      email_verified: claims.email_verified,
      preferred_username: claims.preferred_username,
      picture: claims.picture,
      iss: claims.iss,
      aud: claims.aud,
    };

    req.session.tokens = {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      id_token: tokenSet.id_token,
      token_type: tokenSet.token_type,
      expires_at: tokenSet.expires_in
        ? Date.now() + Number(tokenSet.expires_in) * 1000
        : undefined,
      scope: tokenSet.scope,
    };

    await saveSession(req);

    res.redirect('/profile');
  })
);

app.get(
  '/profile',
  asyncHandler(async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'not_authenticated' });
    }

    res.json({
      authenticated: true,
      user: req.session.user,
    });
  })
);

app.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.clearCookie('sid');
    res.redirect('/');
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('This implementation requires Node.js 18+ with global fetch');
  }

  ({ jwtVerify, createRemoteJWKSet } = await import('jose'));

  provider = await discoverProvider();
  jwks = createRemoteJWKSet(new URL(provider.jwks_uri));

  app.listen(CONFIG.port, () => {
    console.log(`OAuth server listening on http://localhost:${CONFIG.port}`);
    console.log(`Redirect URI: ${CONFIG.redirectUri}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});