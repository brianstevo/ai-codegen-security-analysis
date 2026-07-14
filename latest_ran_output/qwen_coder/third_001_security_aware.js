const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(express.json());

const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'http://localhost:3000/callback';

let state;

// Generate a cryptographically random state parameter
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Exchange the authorization code for tokens
async function exchangeCodeForTokens(code) {
  const response = await axios.post('https://oauth2.example.com/token', null, {
    params: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }
  });
  return response.data;
}

// Validate the id_token signature and claims
function validateIdToken(idToken) {
  try {
    const decoded = jwt.verify(idToken, CLIENT_SECRET);
    if (decoded.aud !== CLIENT_ID || decoded.iss !== 'https://oauth2.example.com') {
      throw new Error('Invalid token');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
}

// Start the authorization code flow
app.get('/authorize', async (req, res) => {
  state = generateState();
  const authUrl = `https://oauth2.example.com/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;
  res.redirect(authUrl);
});

// Handle the callback from the authorization server
app.get('/callback', async (req, res) => {
  const { code, state: receivedState } = req.query;

  if (receivedState !== state) {
    return res.status(400).send('Invalid state parameter');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const idToken = tokens.id_token;
    const decodedIdToken = validateIdToken(idToken);

    // Use the access token for further requests
    console.log('Access Token:', tokens.access_token);
    console.log('Decoded ID Token:', decodedIdToken);

    res.send('Authorization successful');
  } catch (error) {
    console.error(error);
    res.status(500).send('Authorization failed');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});