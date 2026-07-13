const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { URLSearchParams } = require('url');

const app = express();
app.use(express.json());

// Configuration (replace with your OAuth provider's details)
const OAUTH_CONFIG = {
  authorizationEndpoint: 'https://provider.com/oauth/authorize',
  tokenEndpoint: 'https://provider.com/oauth/token',
  jwksUri: 'https://provider.com/.well-known/jwks.json',
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET, // Keep server-side only!
  redirectUri: 'http://localhost:3000/callback',
  issuer: 'https://provider.com/', // Expected issuer (iss) claim
  audience: process.env.OAUTH_CLIENT_ID // Expected audience (aud) claim
};

// In-memory store for state parameters (use Redis or DB in production)
const stateStore = new Map();

// Helper to generate cryptographically secure random string
function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

// Helper to decode JWT header (without verification)
function decodeJWTHeader(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    
    const headerBuffer = Buffer.from(parts[0], 'base64url');
    return JSON.parse(headerBuffer.toString());
  } catch (e) {
    throw new Error(`Failed to decode JWT header: ${e.message}`);
  }
}

// Fetch JWKS and create key resolver
async function getJwks() {
  try {
    const response = await axios.get(OAUTH_CONFIG.jwksUri);
    return response.data.keys;
  } catch (error) {
    throw new Error(`Failed to fetch JWKS: ${error.message}`);
  }
}

// Verify JWT signature using JWKS
async function verifyJwtSignature(token, jwks) {
  const header = decodeJWTHeader(token);
  const key = jwks.find(k => k.kid === header.kid);
  
  if (!key) {
    throw new Error('No matching key found in JWKS');
  }
  
  // Convert JWK to PEM format (simplified for RSA keys)
  const { n, e } = key;
  const modulus = Buffer.from(n, 'base64');
  const exponent = parseInt(e, 10);
  
  // Use node-forge or jwk-to-pem in production; here we use a simplified approach
  // For production, use a library like jsonwebtoken with proper JWK support
  return jwt.verify(token, key, {
    algorithms: ['RS256'],
    audience: OAUTH_CONFIG.audience,
    issuer: OAUTH_CONFIG.issuer
  });
}

// Generate state parameter and store it
function generateAndStoreState() {
  const state = generateRandomString(32);
  stateStore.set(state, crypto.randomBytes(16).toString('hex')); // Store nonce for CSRF protection
  return state;
}

// Route: Initiate OAuth flow
app.get('/login', (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = generatePKCE();
    
    // Generate and store state parameter
    const state = generateAndStoreState();
    
    // Store PKCE verifier in session or secure cookie (in production)
    req.session.codeVerifier = codeVerifier;
    
    // Redirect to authorization endpoint
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      scope: 'openid profile email',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    res.redirect(`${OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// Route: OAuth callback
app.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Validate state parameter to prevent CSRF
    if (!state || !stateStore.has(state)) {
      return res.status(403).json({ error: 'Invalid state parameter (CSRF attack detected)' });
    }
    
    // Remove used state from store
    const storedNonce = stateStore.get(state);
    stateStore.delete(state);
    
    // Verify PKCE code verifier exists in session
    if (!req.session.codeVerifier) {
      return res.status(400).json({ error: 'Missing code verifier' });
    }
    
    // Exchange authorization code for tokens (server-side only)
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret, // Never expose to browser
      code_verifier: req.session.codeVerifier,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code: code
    });
    
    const tokenResponse = await axios.post(OAUTH_CONFIG.tokenEndpoint, tokenParams.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const { access_token, id_token } = tokenResponse.data;
    
    // Verify ID token signature and claims
    const jwks = await getJwks();
    const payload = await verifyJwtSignature(id_token, jwks);
    
    // Additional validation (if not handled by jwt.verify)
    if (payload.iss !== OAUTH_CONFIG.issuer) {
      throw new Error('Invalid issuer in ID token');
    }
    
    if (!Array.isArray(payload.aud) ? payload.aud !== OAUTH_CONFIG.audience : !payload.aud.includes(OAUTH_CONFIG.audience)) {
      throw new Error('Invalid audience in ID token');
    }
    
    // Store user info (in production, use session store or JWT)
    req.session.user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name
    };
    
    // Redirect to protected resource or home page
    res.redirect('/profile');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(400).json({ 
      error: 'OAuth callback failed',
      details: error.message 
    });
  }
});

// Protected route example
app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  res.json({
    message: 'Welcome!',
    user: req.session.user
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OAuth server running on port ${PORT}`);
});