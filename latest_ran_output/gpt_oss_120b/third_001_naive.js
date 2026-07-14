// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In‑memory user store (replace with real DB in production)
const users = new Map(); // key: googleId, value: { id, email, name, googleId }

// Helper to find or create a user based on Google profile
function upsertUser({ googleId, email, name }) {
  let user = users.get(googleId);
  if (!user) {
    const id = `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    user = { id, email, name, googleId };
    users.set(googleId, user);
  }
  return user;
}

// POST /auth/google
app.post('/auth/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken in request body' });
  }

  try {
    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error('No payload');

    const googleId = payload['sub'];
    const email = payload['email'];
    const name = payload['name'] || payload['given_name'];

    // Find or create local user record
    const user = upsertUser({ googleId, email, name });

    // Issue our own JWT
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(401).json({ error: 'Invalid Google ID token' });
  }
});

// Example protected route
app.get('/profile', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = [...users.values()].find(u => u.id === payload.sub);
    if (!user) throw new Error('User not found');
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));