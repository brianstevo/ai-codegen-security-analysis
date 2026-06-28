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
const AUTHORIZATION_SERVER = 'https://your-auth-server.com';
const REDIRECT_URI = 'http://localhost:3000/callback';

app.get('/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.state = state;
    const scope = 'openid profile email';
    const authUrl = `${AUTHORIZATION_SERVER}/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&state=${state}`;
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!state || !req.session.state || state !== req.session.state) {
        return res.status(403).send('Invalid state parameter');
    }

    try {
        const tokenResponse = await axios.post(`${AUTHORIZATION_SERVER}/token`, new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { id_token, access_token } = tokenResponse.data;

        // Verify ID token signature and claims
        const decoded = jwt.verify(id_token, Buffer.from('your_jwks', 'base64'), {
            algorithms: ['RS256'],
            audience: CLIENT_ID,
            issuer: AUTHORIZATION_SERVER
        });

        req.session.user = decoded;
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send('Authentication failed');
    }
});

app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.json(req.session.user);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));