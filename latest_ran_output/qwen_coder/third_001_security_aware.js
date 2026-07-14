const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(express.json());

// Mock client credentials for demonstration purposes
const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const TOKEN_ENDPOINT = 'https://oauth.example.com/token';

// Generate a cryptographically random state parameter
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

// Validate the id_token signature and claims
async function validateIdToken(idToken) {
  try {
    const response = await axios.get(TOKEN_ENDPOINT, {
      params: { token_type_hint: 'id_token', id_token }
    });
    const publicKey = response.data.public_key;
    return jwt.verify(idToken, publicKey, { algorithms: ['RS256'] });
  } catch (error) {
    throw new Error('Invalid id_token');
  }
}

// OAuth 2.0 authorization code flow
app.get('/authorize', async (req, res) => {
  const state = generateState();
  req.session.state = state;
  const authUrl = `https://oauth.example.com/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=http://localhost:3000/callback&state=${state}`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!state || state !== req.session.state) {
    return res.status(400).send('Invalid state parameter');
  }

  try {
    const tokenResponse = await axios.post(TOKEN_ENDPOINT, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:3000/callback',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const { id_token } = tokenResponse.data;
    const payload = await validateIdToken(id_token);
    if (payload.aud !== CLIENT_ID || payload.iss !== 'https://oauth.example.com') {
      throw new Error('Invalid claims');
    }

    res.send('Authorization successful');
  } catch (error) {
    res.status(500).send('Authorization failed');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});