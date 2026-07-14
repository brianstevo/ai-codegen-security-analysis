// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// ---- Config ----------------------------------------------------
const JWT_SECRET = 'your-very-secure-secret'; // replace with env var in prod
const JWT_ISSUER = 'myapp';
const PORT = process.env.PORT || 3000;

// ---- Mock DB (replace with real DB) ----------------------------
const users = [
  // password is bcrypt hash of "password123"
  {
    id: 1,
    email: 'alice@example.com',
    passwordHash:
      '$2b$10$KIX/6G9ZcXx5UeVv3FQhOeY8pJkWzR7gM0EwBfHjL4nGd1yN2aK5u', // bcrypt hash
    name: 'Alice',
  },
];

// ---- Helpers ---------------------------------------------------
function findUserByEmail(email) {
  return users.find((u) => u.email === email);
}

function generateToken(payload, rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : '1h';
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: JWT_ISSUER,
  });
}

// ---- Middleware ------------------------------------------------
function authMiddleware(req, res, next) {
  const token = req.cookies['auth_token'];
  if (!token) return res.status(401).json({ error: 'Unauthenticated' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER });
    req.user = decoded; // attach payload (e.g., id, email)
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---- App Setup -------------------------------------------------
const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// ---- Routes ----------------------------------------------------
/**
 * POST /login
 * Body: { email, password, rememberMe? }
 */
app.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create JWT
  const token = generateToken(
    { id: user.id, email: user.email, name: user.name },
    rememberMe === true
  );

  // Set cookie (HttpOnly, SameSite)
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production', // true in prod
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000, // ms
    path: '/',
  };
  res.cookie('auth_token', token, cookieOptions);

  return res.json({ message: 'Logged in successfully' });
});

/**
 * POST /logout
 */
app.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  return res.json({ message: 'Logged out' });
});

/**
 * GET /profile - protected route example
 */
app.get('/profile', authMiddleware, (req, res) => {
  // In real app fetch fresh user data from DB using req.user.id
  const user = findUserByEmail(req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { passwordHash, ...safeInfo } = user;
  return res.json({ profile: safeInfo });
});

// ---- Server ----------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});