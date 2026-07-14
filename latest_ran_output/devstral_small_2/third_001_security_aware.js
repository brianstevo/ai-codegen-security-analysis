const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const session = require('express-session');

const app = express();
app.use(express.json());
app.use(session({
    secret: 'your_session_secret',
    resave: false,
    saveUninitialized: true
}));

const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const AUTHORIZATION_SERVER = 'https://auth.example.com';
const REDIRECT_URI = 'http://localhost:3000/callback';
const STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// Generate a cryptographically random state parameter
function generateState() {
    return crypto.randomBytes(32).toString('hex');
}

// Validate the state parameter
function validateState(storedState, receivedState) {
    if (!storedState || storedState !== receivedState) {
        throw new Error('Invalid state parameter');
    }
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code) {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);

    try {
        const response = await axios.post(`${AUTHORIZATION_SERVER}/token`, params.toString(), {
            auth: {
                username: CLIENT_ID,
                password: CLIENT_SECRET
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    } catch (error) {
        throw new Error('Failed to exchange code for tokens');
    }
}

// Verify ID token signature and claims
function verifyIdToken(idToken, nonce) {
    const decoded = jwt.verify(idToken, 'public_key_of_authorization_server', { algorithms: ['RS256'] });
    if (decoded.aud !== CLIENT_ID) {
        throw new Error('Invalid audience');
    }
    if (decoded.iss !== AUTHORIZATION_SERVER) {
        throw new Error('Invalid issuer');
    }
    if (decoded.nonce !== nonce) {
        throw new Error('Invalid nonce');
    }
    return decoded;
}

// OAuth 2.0 Authorization Endpoint
app.get('/authorize', (req, res) => {
    const state = generateState();
    const nonce = crypto.randomBytes(16).toString('hex');

    req.session.oauthState = state;
    req.session.oauthNonce = nonce;
    req.session.stateExpiry = Date.now() + STATE_EXPIRY;

    const authUrl = `${AUTHORIZATION_SERVER}/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}&nonce=${nonce}`;
    res.redirect(authUrl);
});

// OAuth 2.0 Callback Endpoint
app.get('/callback', async (req, res) => {
    try {
        const { state, code } = req.query;

        // Validate state parameter
        if (!req.session.oauthState || Date.now() > req.session.stateExpiry) {
            return res.status(400).send('State parameter expired or invalid');
        }
        validateState(req.session.oauthState, state);

        // Exchange code for tokens
        const { id_token, access_token } = await exchangeCodeForTokens(code);

        // Verify ID token
        const userInfo = verifyIdToken(id_token, req.session.oauthNonce);

        // Clear session data
        req.session.destroy();

        res.json({ user: userInfo, access_token });
    } catch (error) {
        console.error(error);
        res.status(500).send('Authentication failed');
    }
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});