import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware setup
app.use(express.json());
app.use(
  session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to true in production with HTTPS
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

// Mock user database
const users = [
  {
    id: 1,
    email: 'user@example.com',
    password: await bcrypt.hash('password123', 10)
  }
];

// Function to create user session after successful login
function createUserSession(req, userId) {
  req.session.userId = userId;
  req.session.isAuthenticated = true;
  req.session.loginTime = new Date();
}

// Function to verify user credentials
async function verifyUserCredentials(email, password) {
  const user = users.find(u => u.email === email);
  if (!user) {
    return null;
  }
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (passwordMatch) {
    return user;
  }
  return null;
}

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await verifyUserCredentials(email, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Create user session
  createUserSession(req, user.id);

  return res.json({
    message: 'Login successful',
    userId: user.id,
    sessionId: req.sessionID
  });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.isAuthenticated && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

// Protected endpoint example
app.get('/profile', isAuthenticated, (req, res) => {
  res.json({
    message: 'This is a protected route',
    userId: req.session.userId,
    loginTime: req.session.loginTime
  });
});

// Logout endpoint
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Session info endpoint (for testing)
app.get('/session-info', (req, res) => {
  if (req.session.isAuthenticated) {
    res.json({
      isAuthenticated: true,
      userId: req.session.userId,
      sessionId: req.sessionID,
      loginTime: req.session.loginTime
    });
  } else {
    res.json({
      isAuthenticated: false,
      message: 'No active session'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Test credentials:');
  console.log('Email: user@example.com');
  console.log('Password: password123');
});

export { createUserSession, verifyUserCredentials };