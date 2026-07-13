// rememberMe.js
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cookieParser());

// In production replace this with a persistent store (e.g., Redis, DB)
const tokenStore = new Map(); // token => userId

// Session middleware (adjust secret & store as needed)
app.use(
  session({
    name: 'sid',
    secret: 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // set to true when using HTTPS
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day session
    },
  })
);

// ---------- Remember‑Me Helpers ----------
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setRememberMeCookie(res, token) {
  res.cookie('remember_me', token, {
    httpOnly: true,
    secure: true, // ensure HTTPS
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/', // adjust if needed
  });
}

function clearRememberMeCookie(res) {
  res.clearCookie('remember_me', { path: '/' });
}

// Middleware to auto‑login via remember‑me token
async function rememberMeMiddleware(req, res, next) {
  if (req.session && req.session.userId) return next(); // already logged in

  const token = req.cookies['remember_me'];
  if (!token) return next();

  const userId = tokenStore.get(token);
  if (!userId) {
    clearRememberMeCookie(res);
    return next();
  }

  // Token is valid – rotate it
  tokenStore.delete(token);
  const newToken = generateToken();
  tokenStore.set(newToken, userId);
  setRememberMeCookie(res, newToken);

  // Attach user info to session (replace with DB lookup if needed)
  req.session.userId = userId;
  next();
}

// ---------- Mock User Store ----------
const mockUsers = [
  { id: '1', username: 'alice', password: 'password123' }, // replace with hashed passwords
];

// Simple credential check (replace with bcrypt compare in real app)
function verifyCredentials(username, password) {
  const user = mockUsers.find((u) => u.username === username && u.password === password);
  return user || null;
}

// ---------- Routes ----------
app.post('/login', async (req, res) => {
  const { username, password, rememberMe } = req.body;
  const user = verifyCredentials(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // Create session
  req.session.userId = user.id;

  // If remember‑me requested, issue token
  if (rememberMe) {
    const token = generateToken();
    tokenStore.set(token, user.id);
    setRememberMeCookie(res, token);
  }

  res.json({ message: 'Logged in' });
});

app.post('/logout', async (req, res) => {
  // Remove remember‑me token if present
  const token = req.cookies['remember_me'];
  if (token) tokenStore.delete(token);

  // Destroy session and clear cookie
  req.session.destroy(() => {});
  clearRememberMeCookie(res);
  res.json({ message: 'Logged out' });
});

app.get('/protected', rememberMeMiddleware, async (req, res) => {
  if (!req.session || !req.session.userId)
    return res.status(401).json({ error: 'Unauthenticated' });

  // In a real app fetch full user data here
  const user = mockUsers.find((u) => u.id === req.session.userId);
  res.json({ message: `Hello, ${user.username}! This is protected data.` });
});

// ---------- Server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on https://localhost:${PORT}`);
});