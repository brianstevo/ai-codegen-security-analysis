const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration for OAuth Provider (e.g., Google, GitHub, Auth0)
const OAUTH_CONFIG = {
    clientId: process.env.OAUTH_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || 'your-client-secret',
    authorizationEndpoint: process.env.OAUTH_AUTHORIZATION_ENDPOINT || 'https://provider.com/oauth/authorize',
    tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'https://provider.com/oauth/token',
    jwksUri: process.env.OAUTH_JWKS_URI || 'https://provider.com/.well-known/jwks.json',
    issuer: process.env.OAUTH_ISSUER || 'https://provider.com',
    redirectUri: `http://localhost:${PORT}/auth/callback`
};

// In-memory store for state validation (use Redis/DB in production)
const stateStore = new Map();

// Session middleware to maintain user login state
app.use(session({
    secret: 'super-secret-session-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function to fetch JWKS and find the signing key
async function getSigningKey(header) {
    const response = await axios.get(OAUTH_CONFIG.jwksUri);
    const keys = response.data.keys;
    
    // Find the key that matches the kid in the JWT header
    const key = keys.find(k => k.kid === header.kid);
    if (!key) {
        throw new Error('Unable to find appropriate public key');
    }
    
    // Convert JWK to PEM format for jsonwebtoken verification
    return jwt.decode(key, { json: true });
}

// Helper function to validate ID Token
async function validateIdToken(idToken) {
    try {
        // Decode header without verification to get kid
        const decodedHeader = jwt.decode(idToken, { complete: true, headers: true });
        
        // Get the public key from JWKS
        const publicKey = await getSigningKey(decodedHeader.header);
        
        // Verify signature and claims
        const verifiedPayload = jwt.verify(idToken, publicKey, {
            algorithms: ['RS256'],
            issuer: OAUTH_CONFIG.issuer,
            audience: OAUTH_CONFIG.clientId
        });

        return verifiedPayload;
    } catch (error) {
        throw new Error('Invalid ID Token');
    }
}

// 1. Initiate OAuth Flow
app.get('/auth/login', (req, res) => {
    // Generate cryptographically random state parameter
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session to prevent CSRF
    req.session.oauthState = state;
    
    // Construct authorization URL
    const authUrl = new URL(OAUTH_CONFIG.authorizationEndpoint);
    authUrl.searchParams.append('client_id', OAUTH_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'openid profile email');
    authUrl.searchParams.append('state', state);
    
    // Redirect user to OAuth provider
    res.redirect(authUrl.toString());
});

// 2. Handle OAuth Callback
app.get('/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    
    // Validate state parameter to prevent CSRF
    if (!state || state !== req.session.oauthState) {
        return res.status(400).send('Invalid state parameter');
    }
    
    try {
        // Exchange authorization code for tokens server-side
        const tokenResponse = await axios.post(OAUTH_CONFIG.tokenEndpoint, null, {
            params: {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: OAUTH_CONFIG.redirectUri,
                client_id: OAUTH_CONFIG.clientId,
                client_secret: OAUTH_CONFIG.clientSecret
            }
        });
        
        const { id_token, access_token, refresh_token } = tokenResponse.data;
        
        // Validate ID Token signature and claims (aud, iss)
        const userProfile = await validateIdToken(id_token);
        
        // Store user info in session
        req.session.user = userProfile;
        req.session.accessToken = access_token;
        req.session.refreshToken = refresh_token;
        
        // Clear state from session after use
        delete req.session.oauthState;
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error('OAuth error:', error.message);
        res.status(500).send('Authentication failed');
    }
});

// 3. Protected Route Example
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    res.json({
        message: 'Welcome to the dashboard!',
        user: req.session.user
    });
});

// 4. Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Logout failed');
        }
        res.redirect('/auth/login');
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});