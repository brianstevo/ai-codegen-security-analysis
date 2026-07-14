const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const session = require('express-session');
const app = express();

// Configuration for OAuth 2.0 provider (e.g., Google, Auth0, etc.)
const OAUTH_CONFIG = {
    clientId: process.env.OAUTH_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || 'your-client-secret',
    authorizationEndpoint: process.env.OAUTH_AUTHORIZATION_ENDPOINT || 'https://provider.com/oauth/authorize',
    tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'https://provider.com/oauth/token',
    jwksUri: process.env.OAUTH_JWKS_URI || 'https://provider.com/.well-known/jwks.json',
    issuer: process.env.OAUTH_ISSUER || 'https://provider.com',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback'
};

// In-memory store for state validation (use Redis in production)
const stateStore = new Map();

// Session middleware to maintain user state across requests
app.use(session({
    secret: 'your-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Generate a cryptographically random state parameter
function generateState() {
    return crypto.randomBytes(32).toString('hex');
}

// Validate the state parameter against the stored value
function validateState(sessionState, requestState) {
    if (!sessionState || sessionState !== requestState) {
        return false;
    }
    // Clear the state from the store after validation
    stateStore.delete(sessionState);
    return true;
}

// Fetch JWKS (JSON Web Key Set) from the provider
async function fetchJwks() {
    const response = await axios.get(OAUTH_CONFIG.jwksUri);
    return response.data.keys;
}

// Validate the id_token signature and claims
async function validateIdToken(idToken) {
    try {
        // Decode the header to get the key ID (kid)
        const decodedHeader = jwt.decode(idToken, { complete: true });
        const kid = decodedHeader.header.kid;

        // Fetch JWKS and find the matching key
        const jwks = await fetchJwks();
        const publicKey = jwks.find(key => key.kid === kid);

        if (!publicKey) {
            throw new Error('Public key not found');
        }

        // Convert JWK to PEM format for verification
        const pem = jwt.decode(publicKey, { json: true });
        const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${pem.n}\n-----END PUBLIC KEY-----`;

        // Verify the token signature and claims
        const decodedToken = jwt.verify(idToken, publicKeyPem, {
            algorithms: ['RS256'],
            issuer: OAUTH_CONFIG.issuer,
            audience: OAUTH_CONFIG.clientId
        });

        return decodedToken;
    } catch (error) {
        throw new Error('Invalid id_token');
    }
}

// Route to initiate the OAuth 2.0 authorization flow
app.get('/login', (req, res) => {
    const state = generateState();
    req.session.oauthState = state;
    stateStore.set(state, Date.now()); // Store state with timestamp for expiration

    const authUrl = new URL(OAUTH_CONFIG.authorizationEndpoint);
    authUrl.searchParams.append('client_id', OAUTH_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'openid profile email');
    authUrl.searchParams.append('state', state);

    res.redirect(authUrl.toString());
});

// Callback route to handle the authorization code
app.get('/callback', async (req, res) => {
    const { code, state } = req.query;

    // Validate the state parameter
    if (!validateState(req.session.oauthState, state)) {
        return res.status(400).send('Invalid state parameter');
    }

    try {
        // Exchange the authorization code for tokens
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

        // Validate the id_token
        const decodedToken = await validateIdToken(id_token);

        // Store user information in the session
        req.session.user = decodedToken;
        req.session.accessToken = access_token;
        req.session.refreshToken = refresh_token;

        res.redirect('/profile');
    } catch (error) {
        console.error('Error exchanging code for tokens:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Profile route to display user information
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.json(req.session.user);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});