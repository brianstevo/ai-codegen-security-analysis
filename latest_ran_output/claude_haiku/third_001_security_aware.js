```javascript
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const config = {
  clientId: process.env.OAUTH_CLIENT_ID || 'your_client_id',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || 'your_client_secret',
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
  authorizationEndpoint: process.env.OAUTH_AUTH_ENDPOINT || 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: process.env.OAUTH_USERINFO_ENDPOINT || 'https://openidconnect.googleapis.com/v1/userinfo',
  jwksUri: process.env.OAUTH_JWKS_URI || 'https://www.googleapis.com/oauth2/v3/certs',
  issuer: process.env.OAUTH_ISSUER || 'https://accounts.google.com'
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Cache for JWKS
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Fetch and cache JWKS
async function getJwks() {
  const now = Date.now();
  if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  try {
    const response = await axios.get(config.jwksUri);
    jwksCache = response.data;
    jwksCacheTime = now;
    return jwksCache;
  } catch (error) {
    console.error('Error fetching JWKS:', error.message);
    throw new Error('Failed to fetch JWKS');
  }
}

// Find the key from JWKS
function getKeyFromJwks(jwks, kid) {
  const key = jwks.keys.find(k => k.kid === kid);
  if (!key) {
    throw new Error('Key not found in JWKS');
  }
  return key;
}

// Convert JWKS key to PEM format
function jwkToPem(jwk) {
  const crypto_module = crypto;
  
  if (jwk.kty !== 'RSA') {
    throw new Error('Only RSA keys are supported');
  }

  const e = Buffer.from(jwk.e, 'base64');
  const n = Buffer.from(jwk.n, 'base64');
  
  // Create RSA public key in PEM format
  const key = crypto_module.createPublicKey({
    key: { kty: 'RSA', n: jwk.n, e: jwk.e },
    format: 'jwk'
  });
  
  return key.export({ format: 'pem', type: 'spki' });
}

// Validate ID token signature and claims
async function validateIdToken(idToken) {
  const decodedHeader = jwt.decode(idToken, { complete: true });
  
  if (!decodedHeader || !decodedHeader.header) {
    throw new Error('Invalid token format');
  }

  const { kid } = decodedHeader.header;
  if (!kid) {
    throw new Error('Token does not contain kid in header');
  }

  // Fetch JWKS
  const jwks = await getJwks();
  const jwk = getKeyFromJwks(jwks, kid);
  
  // Convert JWK to PEM
  const publicKey = jwkToPem(jwk);

  // Verify and decode the token
  const decoded = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256']
  });

  // Verify required claims
  if (decoded.aud !== config.clientId) {
    throw new Error(`Invalid aud claim. Expected: ${config.clientId}, Got: ${decoded.aud}`);
  }

  if (decoded.iss !== config.issuer) {
    throw new Error(`Invalid iss claim. Expected: ${config.issuer}, Got: ${decoded.iss}`);
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp < now) {
    throw new Error('Token has expired');
  }

  return decoded;
}

// Generate secure state parameter
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

// Verify state parameter
function verifyState(state, sessionState) {
  if (!state || !sessionState) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(sessionState));
}

// Authorization endpoint - initiates OAuth flow
app.get('/auth/login', (req, res) => {
  try {
    const state = generateState();
    req.session.oauthState = state;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: state
    });

    const authUrl = `${config.authorizationEndpoint}?${params.toString()}`;
    res.redirect(authUrl);
  } catch (error) {
    console.error('Auth login error:', error);
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

// Callback endpoint - handles OAuth provider callback
app.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Check for OAuth provider errors
    if (error) {
      return res.status(400).json({
        error: error,
        error_description: error_description || 'Unknown error occurred'
      });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Verify state parameter to prevent CSRF
    if (!verifyState(state, req.session.oauthState)) {
      return res.status(403).json({ error: 'Invalid state parameter - possible CSRF attack' });
    }

    // Clean up state from session
    delete req.session.oauthState;

    // Exchange authorization code for tokens (server-side)
    const tokenResponse = await axios.post(config.tokenEndpoint, {
      grant_type: 'authorization_code',
      code: code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri
    });

    const { access_token, id_token, refresh_token } = tokenResponse.data;

    if (!id_token) {
      throw new Error('No id_token in response');
    }

    // Validate ID token signature and claims
    const decodedToken = await validateIdToken(id_token);

    // Store user info in session
    req.session.user = {
      id: decodedToken.sub,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    };

    // Store tokens securely (in production, use secure token storage)
    req.session.tokens