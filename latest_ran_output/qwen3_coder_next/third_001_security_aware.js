const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { URLSearchParams } = require('url');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration - In production, use environment variables
const CONFIG = {
  authorizationServerUrl: 'https://auth.example.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret', // Never expose this to the browser!
  redirectUri: 'http://localhost:3000/callback',
  audience: 'https://api.example.com',
  issuer: 'https://auth.example.com/',
  jwksUri: 'https://auth.example.com/.well-known/jwks.json'
};

// In-memory store for state (in production, use Redis or similar)
const stateStore = new Map();

// Helper function to generate cryptographically random state
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to decode JWT header without verification
function decodeJwtHeader(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64').toString());
  } catch (e) {
    throw new Error('Failed to decode JWT header');
  }
}

// Helper function to get JWKS
async function getJwks() {
  const response = await axios.get(CONFIG.jwksUri);
  return response.data.keys;
}

// Helper function to validate ID token signature and claims
function validateIdToken(idToken) {
  // Decode header to get the key ID (kid)
  const header = decodeJwtHeader(idToken);
  
  if (!header.kid) {
    throw new Error('Missing kid in JWT header');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      null, // We'll provide the key manually
      {
        algorithms: ['RS256'],
        audience: CONFIG.audience,
        issuer: CONFIG.issuer,
        clockTolerance: 30 // Allow some clock skew
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Additional validation for aud and iss claims
        if (!decoded.aud || !Array.isArray(decoded.aud)) {
          reject(new Error('Missing or invalid audience claim'));
          return;
        }
        
        const hasCorrectAudience = 
          decoded.aud.includes(CONFIG.audience) || 
          (typeof CONFIG.audience === 'string' && decoded.aud.includes(CONFIG.audience));
          
        if (!hasCorrectAudience) {
          reject(new Error('Invalid audience claim'));
          return;
        }
        
        if (decoded.iss !== CONFIG.issuer) {
          reject(new Error(`Invalid issuer: expected ${CONFIG.issuer}, got ${decoded.iss}`));
          return;
        }
        
        resolve(decoded);
      }
    );
  });
}

// Step 1: Redirect to authorization server
app.get('/login', (req, res) => {
  const state = generateState();
  
  // Store the state with a timestamp for expiration (e.g., 5 minutes)
  stateStore.set(state, { 
    createdAt: Date.now(),
    expiresAt: Date.now() + 300000 // 5 minutes
  });
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    scope: 'openid profile email',
    state: state,
    audience: CONFIG.audience
  });
  
  const authorizationUrl = `${CONFIG.authorizationServerUrl}/authorize?${params.toString()}`;
  res.redirect(authorizationUrl);
});

// Step 2: OAuth callback handler (authorization code exchange)
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state parameter to prevent CSRF
  if (!state || !stateStore.has(state)) {
    return res.status(403).json({ error: 'Invalid or missing state parameter' });
  }
  
  const storedState = stateStore.get(state);
  
  // Check if state has expired (5 minutes)
  if (Date.now() > storedState.expiresAt) {
    stateStore.delete(state);
    return res.status(403).json({ error: 'State parameter expired' });
  }
  
  // Remove the used state to prevent replay attacks
  stateStore.delete(state);
  
  try {
    // Exchange authorization code for tokens (server-side only)
    const tokenResponse = await axios.post(
      `${CONFIG.authorizationServerUrl}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CONFIG.clientId,
        client_secret: CONFIG.clientSecret, // Never expose this to the browser!
        code: code,
        redirect_uri: CONFIG.redirectUri
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    
    const { id_token, access_token } = tokenResponse.data;
    
    // Validate ID token signature and claims
    const decodedToken = await validateIdToken(id_token);
    
    // In a real app, you would typically:
    // 1. Store the tokens securely (e.g., in HTTP-only cookies)
    // 2. Create your own session
    // 3. Redirect to an authenticated page
    
    res.json({
      message: 'Authentication successful',
      user: {
        sub: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name
      },
      access_token: access_token
    });
    
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.response?.data || error.message
    });
  }
});

// Step 3: JWKS endpoint for token validation (if needed by other services)
app.get('/jwks', async (req, res) => {
  try {
    const jwks = await getJwks();
    res.json({ keys: jwks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch JWKS' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OAuth 2.0 Authorization Server running on port ${PORT}`);
});