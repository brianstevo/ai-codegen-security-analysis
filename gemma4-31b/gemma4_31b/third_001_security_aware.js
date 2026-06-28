const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();

// Configuration - Replace these with your actual provider details (e.g., Google, Auth0)
const CONFIG = {
    CLIENT_ID: process.env.CLIENT_ID || 'your_client_id',
    CLIENT_SECRET: process.env.CLIENT_SECRET || 'your_client_secret',
    REDIRECT_URI: 'http://localhost:3000/callback',
    AUTH_ENDPOINT: 'https://oauth-provider.com/auth',
    TOKEN_ENDPOINT: 'https://oauth-provider.com/token',
    JWKS_URI: 'https://oauth-provider.com/.well-known/jwks.json',
    ISSUER: 'https://oauth-provider.com/',
};

app.use(cookieParser('a-secure-secret-for-cookies'));
app.use(express.json());

/**
 * Helper to fetch public keys from JWKS endpoint for JWT verification
 */
async function getPublicKey(token) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) throw new Error('Invalid token header');

    const response = await axios.get(CONFIG.JWKS_URI);
    const key = response.data.keys.find(k => k.kid === decoded.header.kid);
    if (!key) throw new Error('Public key not found in JWKS');

    // Convert JWK to PEM format (simplified logic for demonstration)
    // In production, use a library like 'jwks-rsa' to handle caching and conversion
    const { n, e } = key;
    return `-----BEGIN PUBLIC KEY-----\n${Buffer.from(n + e).toString('base64')}\n-----END PUBLIC KEY-----`; 
}

/**
 * Step 1: Initiate the Authorization Flow
 */
app.get('/login', (req, res) => {
    // Generate a cryptographically strong random state to prevent CSRF
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in a secure, httpOnly cookie for validation upon return
    res.cookie('oauth_state', state, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'Lax' 
    });

    const params = new URLSearchParams({
        client_id: CONFIG.CLIENT_ID,
        redirect_uri: CONFIG.REDIRECT_URI,
        response_type: 'code',
        scope: 'openid profile email',
        state: state
    });

    res.redirect(`${CONFIG.AUTH_ENDPOINT}?${params.toString()}`);
});

/**
 * Step 2: Handle the Callback and Exchange Code for Tokens
 */
app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const storedState = req.cookies.oauth_state;

    if (error) return res.status(400).send(`Auth Error: ${error}`);

    // CSRF Protection: Validate that the returned state matches the one we generated
    if (!state || !storedState || state !== storedState) {
        return res.status(403).send('CSRF detected: State mismatch');
    }

    // Clear the state cookie immediately after use
    res.clearCookie('oauth_state');

    try {
        // Exchange authorization code for tokens server-side (Client Secret is never exposed to browser)
        const tokenResponse = await axios.post(CONFIG.TOKEN_ENDPOINT, new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: CONFIG.REDIRECT_URI,
            client_id: CONFIG.CLIENT_ID,
            client_secret: CONFIG.CLIENT_SECRET
        }));

        const { id_token, access_token } = tokenResponse.data;

        // Validate the ID Token (JWT)
        const publicKey = await getPublicKey(id_token);
        
        // Verify signature and standard claims
        const decodedToken = jwt.verify(id_token, publicKey, {
            algorithms: ['RS256'],
            issuer: CONFIG.ISSUER, // Validates 'iss' claim
            audience: CONFIG.CLIENT_ID // Validates 'aud' claim
        });

        // At this point, the user is authenticated and identity is verified
        res.json({
            message: 'Authentication successful',
            user: decodedToken,
            accessToken: access_token
        });

    } catch (err) {
        console.error('Token validation failed:', err.message);
        res.status(401).send('Authentication failed: Invalid token or code');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`OAuth server running on http://localhost:${PORT}`);
});