const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = express();

// Configuration (In production, use environment variables)
const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const AUTHORIZATION_ENDPOINT = 'https://provider.com/oauth/authorize';
const TOKEN_ENDPOINT = 'https://provider.com/oauth/token';
const REDIRECT_URI = 'http://localhost:3000/callback';
const ISSUER = 'https://provider.com';

// In-memory state store (In production, use a proper session store with expiration)
const stateStore = new Map();

/**
 * Helper to fetch JWKS (JSON Web Key Set) from the issuer
 * to verify the signature of the ID token.
 */
async function getJwks() {
  try {
    const response = await axios.get(`${ISSUER}/.well-known/jwks.json`);
    return response.data.keys;
  } catch (error) {
    throw new Error('Failed to fetch JWKS');
  }
}

/**
 * Helper to find the specific key in JWKS based on Key ID (kid)
 */
function getKey(kid, keys) {
  const key = keys.find(k => k.kid === kid);
  if (!key) throw new Error('Unable to find key matching kid');
  return key;
}

/**
 * Route 1: Initiate the Authorization Code Flow
 */
app.get('/login', (req, res) => {
  // 1. Generate cryptographically random state parameter
  const state = crypto.randomBytes(32).toString('hex');

  // 2. Store state server-side to validate later (CSRF protection)
  // In production, store with an expiration timestamp
  stateStore.set(state, { timestamp: Date.now() });

  // 3. Redirect to Authorization Server
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state: state,
  });

  res.redirect(`${AUTHORIZATION_ENDPOINT}?${params.toString()}`);
});

/**
 * Route 2: Handle the callback and exchange code for tokens
 */
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. Validate State (CSRF Protection)
  if (!state || !stateStore.has(state)) {
    return res.status(400).send('Invalid state parameter');
  }

  // Remove state to prevent replay attacks
  stateStore.delete(state);

  try {
    // 2. Exchange Authorization Code for Tokens (Server-side)
    // Client secret is never exposed to the browser
    const tokenResponse = await axios.post(TOKEN_ENDPOINT, {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const { id_token, access_token, refresh_token } = tokenResponse.data;

    // 3. Validate ID Token signature and claims
    await verifyIdToken(id_token);

    // 4. Return tokens to client
    res.json({
      access_token,
      refresh_token,
      id_token,
    });
  } catch (error) {
    console.error('Token exchange or validation failed:', error.message);
    res.status(500).send('Authentication failed');
  }
});

/**
 * Helper to validate ID Token
 * - Verifies signature using JWKS
 * - Verifies 'iss' (issuer) claim
 * - Verifies 'aud' (audience) claim
 */
async function verifyIdToken(idToken) {
  try {
    // Fetch JWKS to find the correct signing key
    const jwks = await getJwks();

    // Decode header to get the Key ID (kid)
    const decodedHeader = jwt.decode(idToken, { complete: true });
    if (!decodedHeader || !decodedHeader.header.kid) {
      throw new Error('Invalid ID token header');
    }

    const key = getKey(decodedHeader.header.kid, jwks);

    // Verify the token
    // 'issuer' checks the 'iss' claim
    // 'audience' checks the 'aud' claim
    // 'algorithms' ensures RS256 is used
    jwt.verify(idToken, key, {
      issuer: ISSUER,
      audience: CLIENT_ID,
      algorithms: ['RS256'],
    });
  } catch (error) {
    throw new Error(`ID Token validation failed: ${error.message}`);
  }
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});