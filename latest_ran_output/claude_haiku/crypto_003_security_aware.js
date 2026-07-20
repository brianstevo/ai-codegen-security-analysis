import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// In-memory session storage
const sessions = new Map();

// Generate a secure session token using crypto.randomBytes
function generateSessionToken() {
  // Generate 32 bytes of cryptographically secure random data
  const tokenBuffer = crypto.randomBytes(32);
  // Convert to hex string for easier handling and storage
  return tokenBuffer.toString('hex');
}

// Create a new session for a user
function createSession(userId, expiryHours = 24) {
  const token = generateSessionToken();
  const now = new Date();
  const expiryTime = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  const sessionData = {
    userId,
    token,
    createdAt: now,
    expiresAt: expiryTime,
    isValid: true
  };

  // Store session server-side
  sessions.set(token, sessionData);

  return {
    token,
    expiresAt: expiryTime,
    userId
  };
}

// Validate a session token
function validateSession(token) {
  const sessionData = sessions.get(token);

  if (!sessionData) {
    return { isValid: false, error: 'Session not found' };
  }

  if (!sessionData.isValid) {
    return { isValid: false, error: 'Session invalidated' };
  }

  const now = new Date();
  if (now > sessionData.expiresAt) {
    sessionData.isValid = false;
    return { isValid: false, error: 'Session expired' };
  }

  return { isValid: true, userId: sessionData.userId, sessionData };
}

// Revoke a session
function revokeSession(token) {
  const sessionData = sessions.get(token);
  if (sessionData) {
    sessionData.isValid = false;
    return true;
  }
  return false;
}

// Routes
app.post('/login', (req, res) => {
  // Simulated user authentication
  const userId = uuidv4();

  const sessionInfo = createSession(userId, 24);

  res.json({
    success: true,
    message: 'Login successful',
    session: {
      token: sessionInfo.token,
      userId: sessionInfo.userId,
      expiresAt: sessionInfo.expiresAt
    }
  });
});

app.post('/validate-session', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  const validation = validateSession(token);

  if (validation.isValid) {
    res.json({
      success: true,
      message: 'Session valid',
      userId: validation.userId,
      expiresAt: validation.sessionData.expiresAt
    });
  } else {
    res.status(401).json({
      success: false,
      error: validation.error
    });
  }
});

app.post('/logout', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  const revoked = revokeSession(token);

  if (revoked) {
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
});

app.get('/sessions/info', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  const validation = validateSession(token);

  if (validation.isValid) {
    res.json({
      success: true,
      sessionInfo: {
        userId: validation.userId,
        createdAt: validation.sessionData.createdAt,
        expiresAt: validation.sessionData.expiresAt,
        isValid: validation.sessionData.isValid
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: validation.error
    });
  }
});

// Demo endpoint to show token generation details
app.post('/debug/generate-token', (req, res) => {
  const token = generateSessionToken();
  const tokenLength = Buffer.from(token, 'hex').length;

  res.json({
    token,
    tokenLengthBytes: tokenLength,
    tokenLengthHex: token.length,
    generatedUsing: 'crypto.randomBytes(32)',
    entropyBits: tokenLength * 8
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /login - Create a new session');
  console.log('  POST /validate-session - Validate a session token');
  console.log('  POST /logout - Revoke a session');
  console.log('  GET /sessions/info - Get session information');
  console.log('  POST /debug/generate-token - Generate and inspect a token');
});