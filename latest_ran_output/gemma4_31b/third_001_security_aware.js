const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());
app.use(express.json());

// Configuration - Replace these with environment variables in production
const CONFIG = {
    CLIENT_ID: process.env.CLIENT_ID || 'your_client_id',
    CLIENT_SECRET: process.env.CLIENT_SECRET || 'your_client_secret',
    REDIRECT_URI: 'http://localhost:3000/callback',
    ISSUER: 'https://accounts.google.com', // Example: Google
    AUTH_ENDPOINT: 'https://accounts.google.com/o/oauth2/v2/auth',
    TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
    JWKS_URI: 'https://www.googleapis.com/oauth2/v3/certs',
    SCOPES: 'openid profile email'
};

// JWKS client to fetch public keys for signature validation
const client = jwksClient({
    jwksUri: CONFIG.JWKS_URI,
    cache: true,
    rateLimit: true
});

function getSigningKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

/**
 * Step 1: Initiate Authorization Flow
 * Generates a random state to prevent CSRF and redirects user to Provider
 */
app.get('/login', (req, res) => {
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in an httpOnly cookie for validation upon return
    res.cookie('oauth_state', state, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'Lax' 
    });

    const params = new URLSearchParams({
        client_id: CONFIG.CLIENT_ID,
        redirect_uri: CONFIG.REDIRECT_URI,
        response_type: 'code',
        scope: CONFIG.SCOPES,
        state: state,
        access_type: 'offline',
        prompt: 'consent'
    });

    res.redirect(`${CONFIG.AUTH_ENDPOINT}?${params.toString()}`);
});

/**
 * Step 2: Handle Callback
 * Validates state, exchanges code for tokens, and verifies the ID Token
 */
app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const storedState = req.cookies.oauth_state;

    if (error) return res.status(400).send(`Auth Error: ${error}`);
    if (!code) return res.status(400).send('No authorization code provided.');

    // CSRF Protection: Validate state parameter
    if (!state || state !== storedState) {
        res.clearCookie('oauth_state');
        return res.status(403).send('Invalid state parameter. Possible CSRF attack.');
    }

    res.clearCookie('oauth_state');

    try {
        // Server-to-Server exchange: Code -> Tokens
        // Client Secret is never exposed to the browser
        const tokenResponse = await axios.post(CONFIG.TOKEN_ENDPOINT, {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: CONFIG.REDIRECT_URI,
            client_id: CONFIG.CLIENT_ID,
            client_secret: CONFIG.CLIENT_SECRET
        });

        const { id_token, access_token } = tokenResponse.data;

        // Validate the ID Token (JWT)
        const decodedToken = await verifyIdToken(id_token);

        // Success: User is authenticated and identity verified
        res.json({
            message: 'Authentication successful',
            user: decodedToken,
            access_token: access_token
        });

    } catch (err) {
        console.error('Token Exchange/Validation Error:', err.message);
        res.status(500).send('Authentication failed during token exchange.');
    }
});

/**
 * Helper to verify ID Token signature and claims
 */
function verifyIdToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, getSigningKey, {
            issuer: CONFIG.ISSUER,
            audience: CONFIG.CLIENT_ID,
            algorithms: ['RS256']
        }, (err, decoded) => {
            if (err) return reject(new Error(`JWT Validation Failed: ${err.message}`));
            resolve(decoded);
        });
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`OAuth server running on http://localhost:${PORT}`);
    console.log(`Login URL: http://localhost:${PORT}/login`);
});