import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Secret key for JWT (in production, use environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SESSION_TOKEN_EXPIRY = '24h';

// Mock user database
const users = new Map();

// Function to generate a session token
function generateSessionToken(userId, userData = {}) {
  const token = jwt.sign(
    {
      userId,
      sessionId: crypto.randomBytes(16).toString('hex'),
      ...userData,
    },
    JWT_SECRET,
    { expiresIn: SESSION_TOKEN_EXPIRY }
  );
  return token;
}

// Register endpoint
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (users.has(username)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomBytes(16).toString('hex');

    // Store user
    users.set(username, {
      id: userId,
      password: hashedPassword,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: 'User registered successfully',
      userId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate session token
    const sessionToken = generateSessionToken(user.id, {
      username,
      email: user.email || null,
    });

    res.json({
      success: true,
      message: 'Login successful',
      sessionToken,
      user: {
        id: user.id,
        username,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware to verify session token
function verifySessionToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Session expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Protected endpoint example
app.get('/protected', verifySessionToken, (req, res) => {
  res.json({
    success: true,
    message: 'Access granted to protected resource',
    user: req.user,
  });
});

// Logout endpoint (token invalidation would require a blacklist in production)
app.post('/logout', verifySessionToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});