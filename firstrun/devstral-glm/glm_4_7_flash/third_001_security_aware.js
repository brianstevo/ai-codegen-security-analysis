import express from 'express';
import axios from 'axios';
import { jwtVerify } from 'jose';
import crypto from 'crypto';

const app = express();

// Configuration (Replace with your actual values)
const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'http://localhost:3000/callback';
const ISSUER = 'https://your-identity-provider.com';
const AUDIENCE = 'your-api-resource';

// In-memory state store (Use a proper session store like Redis in production)
const stateStore = new Map();

// Helper to fetch JWKS from the issuer
async function getJWKS() {
    const response = await axios.get(`${ISSUER}/.well-known/jwks.json`);
    return response.data.keys;
}

// Route 1: Authorization Request
app.get('/login', (req, res) => {
    // Generate cryptographically random state
    const state = crypto.randomBytes(16).toString('hex');
    // Store state to validate later
    stateStore.set(state, true);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile email',
        state: state,
    });

    res.redirect(`${ISSUER}/authorize?${params.toString()}`);
});

// Route 2: Callback and Token Exchange
app.get('/callback', async (req, res) => {
    const { code, state } = req.query;

    // 1. Validate State (CSRF Protection)
    if (!state || !stateStore.has(state)) {
        return res.status(400).send('Invalid state parameter');
    }
    stateStore.delete(state);

    try {
        // 2. Exchange Code for Tokens (Server-side)
        // Note: Client secret is never exposed to the browser
        const tokenResponse = await axios.post(`${ISSUER}/token`, {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        }, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, id_token, id_token_kid } = tokenResponse.data;

        if (!id_token) {
            return res.status(400).send('No ID token received');
        }

        // 3. Fetch JWKS for signature verification
        const jwks = await getJWKS();

        // 4. Verify ID Token Signature and Claims
        // Find the matching key from JWKS
        const key = jwks.find(k => k.kid === id_token_kid);
        if (!key) throw new Error('No matching key found in JWKS');

        const { payload } = await jwtVerify(id_token, key, {
            issuer: ISSUER,
            audience: AUDIENCE,
        });

        // 5. Explicit Claim Validation (Optional but recommended)
        if (payload.iss !== ISSUER) {
            throw new Error('Invalid issuer claim');
        }
        if (!payload.aud.includes(AUDIENCE)) {
            throw new Error('Invalid audience claim');
        }

        // Success
        res.json({
            access_token,
            user: payload,
            message: 'Authentication successful'
        });

    } catch (error) {
        console.error('OAuth Error:', error.message);
        res.status(500).send('Authentication failed');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});