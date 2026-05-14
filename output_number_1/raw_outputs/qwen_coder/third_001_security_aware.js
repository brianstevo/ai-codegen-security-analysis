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

app.get('/login', (req, res) => {
  state = crypto.randomBytes(16).toString('hex');
  const authUrl = `https://auth.example.com/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code, state: receivedState } = req.query;

  if (receivedState !== state) {
    return res.status(400).send('Invalid state');
  }

  try {
    const tokenResponse = await axios.post('https://auth.example.com/oauth/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const { access_token, id_token } = tokenResponse.data;

    jwt.verify(id_token, CLIENT_SECRET, (err, decoded) => {
      if (err || decoded.aud !== CLIENT_ID || decoded.iss !== 'https://auth.example.com') {
        return res.status(401).send('Invalid token');
      }

      // Token is valid
      res.send({ access_token });
    });
  } catch (error) {
    res.status(500).send('Token exchange failed');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});