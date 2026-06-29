```javascript
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import session from 'express-session';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();

// Configuration
const config = {
  clientId: process.env.OAUTH_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || 'your-client-secret',
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
  authorizationEndpoint: process.env.AUTH_ENDPOINT || 'https://auth.example.com/authorize',
  tokenEndpoint: process.env.TOKEN_ENDPOINT || 'https://auth.example.com/token',
  jwksUri: process.env.JWKS_URI || 'https://auth.example.com/.well-known/jwks.json',
  issuer: process.env.ISSUER || 'https://auth.example.com',
};

// Session configuration
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true, sameSite: 'lax' }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory store for state parameters (in production, use a database with TTL)
const stateStore = new Map();

// Generate cryptographically random state parameter
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

// Store state with timestamp for expiration
function storeState(state, sessionId) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  stateStore.set(state, { sessionId, expiresAt });
}

// Verify and retrieve state
function verifyState(state, sessionId) {
  const stored = stateStore.get(state);
  if (!stored) {
    return false;
  }
  
  // Check expiration
  if (Date.now() > stored.expiresAt) {
    stateStore.delete(state);
    return false;
  }
  
  // Verify session match
  if (stored.sessionId !== sessionId) {
    return false;
  }
  
  // State is valid, remove it (can only be used once)
  stateStore.delete(state);
  return true;
}

// JWKS cache
let jwksSet = null;
let jwksExpiry = 0;

async function getJWKSet() {
  // Cache JWKS for 1 hour
  if (jwksSet && Date.now() < jwksExpiry) {
    return jwksSet;
  }
  
  try {
    jwksSet = createRemoteJWKSet(new URL(config.jwksUri));
    jwksExpiry = Date.now() + 60 * 60 * 1000;
    return jwksSet;
  } catch (error) {
    console.error('Failed to fetch JWKS:', error);
    throw new Error('Unable to fetch JWKS');
  }
}

// Login endpoint - initiates OAuth flow
app.get('/login', (req, res) => {
  // Generate state parameter
  const state = generateState();
  
  // Store state in session
  req.session.state = state;
  
  // Also store in our state store with session ID
  storeState(state, req.sessionID);
  
  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state: state,
  });
  
  const authUrl = `${config.authorizationEndpoint}?${params.toString()}`;
  res.redirect(authUrl);
});

// Callback endpoint - handles OAuth response
app.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Check for OAuth errors
    if (error) {
      return res.status(400).json({
        error: error,
        error_description: error_description || 'No error description provided'
      });
    }
    
    // Validate code and state parameters
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }
    
    // CSRF Protection: Verify state parameter
    if (!verifyState(state, req.sessionID)) {
      return res.status(403).json({ error: 'Invalid state parameter - CSRF attack detected' });
    }
    
    // Exchange authorization code for tokens (server-side)
    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: config.clientId,
        client_secret: config.clientSecret, // Never exposed to client
        redirect_uri: config.redirectUri,
      }).toString(),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token endpoint error:', errorData);
      return res.status(tokenResponse.status).json({
        error: 'Failed to exchange authorization code'
      });
    }
    
    const tokens = await tokenResponse.json();
    
    // Validate ID token
    if (!tokens.id_token) {
      return res.status(400).json({ error: 'No ID token received' });
    }
    
    // Verify and validate ID token signature
    const jwkSet = await getJWKSet();
    let idTokenPayload;
    
    try {
      const verified = await jwtVerify(tokens.id_token, jwkSet, {
        issuer: config.issuer,
        audience: config.clientId,
      });
      idTokenPayload = verified.payload;
    } catch (verifyError) {
      console.error('ID token verification failed:', verifyError.message);
      return res.status(401).json({
        error: 'ID token verification failed',
        details: verifyError.message
      });
    }
    
    // Additional claim validation
    if (idTokenPayload.aud !== config.clientId) {
      return res.status(401).json({
        error: 'Invalid audience in ID token'
      });
    }
    
    if (idTokenPayload.iss !== config.issuer) {
      return res.status(401).json({
        error: 'Invalid issuer in ID token'
      });
    }
    
    // Validate token expiration
    if (Date.now() / 1000 > idTokenPayload.exp) {
      return res.status(401).json({
        error: 'ID token has expired'
      });
    }
    
    // Store tokens securely in session
    req.session.tokens = {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    };
    
    // Store user information from ID token
    req.session.user = {
      sub: idTokenPayload.sub,
      name: idTokenPayload.name,
      email: idTokenPayload.email,
      picture: idTokenPayload.picture,
    };
    
    // Redirect to dashboard or return success
    res.json({
      success: true,
      message: 'Successfully authenticated',
      user: req.session.user
    });
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      details: error