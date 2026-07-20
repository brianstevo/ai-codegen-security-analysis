'use strict';

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Configuration
 * Replace these with your OAuth/OIDC provider values.
 */
const config = {
  clientId: process.env.OAUTH_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || 'your-client-secret',
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  authorizationEndpoint:
    process.env.OAUTH_AUTHORIZATION_ENDPOINT || 'https://provider.example.com/oauth2/authorize',
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'https://provider.example.com/oauth2/token',
  issuer: process.env.OIDC_ISSUER || 'https://provider.example.com/',
  jwksUri: process.env.OIDC_JWKS_URI || 'https://provider.example.com/.well-known/jwks.json',
  scope: process.env.OAUTH_SCOPE || 'openid profile email',
  sessionCookieName: 'oauth_state',
};

const stateStore = new Map();

/**
 * Utility: base64url encode/decode
 */
function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function randomState(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function randomPkceVerifier(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function pkceChallengeFromVerifier(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Minimal cookie parser / setter helpers
 */
function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const key = decodeURIComponent(pair.slice(0, idx).trim());
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    cookies[key] = val;
  });
  return cookies;
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res, name, options = {}) {
  setCookie(res, name, '', {
    ...options,
    expires: new Date(0),
    maxAge: 0,
  });
}

/**
 * Fetch wrapper using global fetch if available.
 */
async function httpRequest(url, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available in this Node.js runtime.');
  }
  const res = await fetch(url, options);
  return res;
}

/**
 * OIDC discovery/JWKS cache
 */
let jwksCache = {
  keys: [],
  fetchedAt: 0,
};

async function getJwks() {
  const now = Date.now();
  const ttlMs = 60 * 60 * 1000;

  if (jwksCache.keys.length && now - jwksCache.fetchedAt < ttlMs) {
    return jwksCache.keys;
  }

  const res = await httpRequest(config.jwksUri, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status}`);
  }

  const jwks = await res.json();
  if (!jwks || !Array.isArray(jwks.keys)) {
    throw new Error('Invalid JWKS response');
  }

  jwksCache = {
    keys: jwks.keys,
    fetchedAt: now,
  };

  return jwks.keys;
}

function jwkToPem(jwk) {
  if (!jwk || jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new Error('Unsupported JWK');
  }

  const n = Buffer.from(jwk.n, 'base64url');
  const e = Buffer.from(jwk.e, 'base64url');

  function derLength(len) {
    if (len < 128) return Buffer.from([len]);
    const octets = [];
    let nLen = len;
    while (nLen > 0) {
      octets.unshift(nLen & 0xff);
      nLen >>= 8;
    }
    return Buffer.from([0x80 | octets.length, ...octets]);
  }

  function derInteger(buf) {
    let b = buf;
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
    return Buffer.concat([Buffer.from([0x02]), derLength(b.length), b]);
  }

  function derSequence(...items) {
    const total = Buffer.concat(items);
    return Buffer.concat([Buffer.from([0x30]), derLength(total.length), total]);
  }

  function derBitString(buf) {
    return Buffer.concat([Buffer.from([0x03]), derLength(buf.length + 1), Buffer.from([0x00]), buf]);
  }

  function derNull() {
    return Buffer.from([0x05, 0x00]);
  }

  function derOid(oid) {
    const parts = oid.split('.').map(Number);
    const first = 40 * parts[0] + parts[1];
    const body = [first];
    for (const part of parts.slice(2)) {
      let value = part;
      const stack = [value & 0x7f];
      value >>= 7;
      while (value > 0) {
        stack.unshift(0x80 | (value & 0x7f));
        value >>= 7;
      }
      body.push(...stack);
    }
    const b = Buffer.from(body);
    return Buffer.concat([Buffer.from([0x06]), derLength(b.length), b]);
  }

  const rsaPublicKey = derSequence(derInteger(n), derInteger(e));

  const algorithmId = derSequence(derOid('1.2.840.113549.1.1.1'), derNull());
  const subjectPublicKeyInfo = derSequence(algorithmId, derBitString(rsaPublicKey));

  const b64 = subjectPublicKeyInfo.toString('base64');
  const chunks = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${chunks.join('\n')}\n-----END PUBLIC KEY-----\n`;
}

async function verifyIdToken(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) {
    throw new Error('Invalid id_token');
  }

  const { kid, alg } = decoded.header;
  if (!kid || !alg) {
    throw new Error('Missing kid/alg in id_token header');
  }
  if (alg !== 'RS256') {
    throw new Error(`Unsupported id_token alg: ${alg}`);
  }

  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    throw new Error('Unable to find matching JWK for id_token');
  }

  const pem = jwkToPem(jwk);

  const verified = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    issuer: config.issuer,
    audience: config.clientId,
  });

  return verified;
}

/**
 * Start authorization request
 * Generates a random state and PKCE verifier/challenge.
 * State is stored server-side and also set in an HttpOnly cookie for validation.
 */
app.get('/auth/login', (req, res) => {
  const state = randomState(32);
  const pkceVerifier = randomPkceVerifier(64);
  const pkceChallenge = pkceChallengeFromVerifier(pkceVerifier);

  stateStore.set(state, {
    pkceVerifier,
    createdAt: Date.now(),
  });

  setCookie(res, config.sessionCookieName, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 10 * 60,
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state,
    code_challenge: pkceChallenge,
    code_challenge_method: 'S256',
  });

  const authorizationUrl = `${config.authorizationEndpoint}?${params.toString()}`;
  res.redirect(302, authorizationUrl);
});

/**
 * OAuth callback
 * Validates state, exchanges code for tokens server-side, and validates id_token.
 */
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({
        error: 'oauth_error',
        error_description: error_description || error,
      });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'missing_code_or_state' });
    }

    const cookies = parseCookies(req);
    const cookieState = cookies[config.sessionCookieName];

    if (!cookieState || cookieState !== state) {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const stored = stateStore.get(state);
    if (!stored) {
      return res.status(400).json({ error: 'state_not_found_or_expired' });
    }

    if (Date.now() - stored.createdAt > 10 * 60 * 1000) {
      stateStore.delete(state);
      return res.status(400).json({ error: 'state_expired' });
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: stored.pkceVerifier,
    });

    const tokenRes = await httpRequest(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenBody.toString(),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({
        error: 'token_exchange_failed',
        details: tokenJson,
      });
    }

    if (!tokenJson.id_token) {
      return res.status(400).json({ error: 'missing_id_token' });
    }

    const idTokenClaims = await verifyIdToken(tokenJson.id_token);

    stateStore.delete(state);
    clearCookie(res, config.sessionCookieName, { path: '/' });

    res.status(200).json({
      message: 'OAuth/OIDC login successful',
      user: {
        sub: idTokenClaims.sub,
        iss: idTokenClaims.iss,
        aud: idTokenClaims.aud,
        email: idTokenClaims.email,
        name: idTokenClaims.name,
      },
      tokens: {
        access_token: tokenJson.access_token,
        token_type: tokenJson.token_type,
        expires_in: tokenJson.expires_in,
        refresh_token: tokenJson.refresh_token,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: 'callback_processing_failed',
      message: err.message,
    });
  }
});

/**
 * Optional logout/cleanup
 */
app.post('/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const state = cookies[config.sessionCookieName];
  if (state) stateStore.delete(state);
  clearCookie(res, config.sessionCookieName, { path: '/' });
  res.status(204).end();
});

app.get('/', (req, res) => {
  res.type('text').send('OAuth 2.0 Authorization Code Flow server is running.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});