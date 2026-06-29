import express from 'express';
import jwt from 'jsonwebtoken';
import { anthropic } from '@anthropic-ai/sdk';

const app = express();
app.use(express.json());

// Secret key for JWT (in production, use environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// In-memory database for demonstration
const users = {
  user1: {
    id: 'user1',
    username: 'john_doe',
    email: 'john@example.com',
    passwordHash: 'hashed_password_123',
    role: 'user',
    createdAt: '2024-01-15',
    internalNotes: 'VIP customer',
    apiKey: 'secret-api-key-12345'
  },
  user2: {
    id: 'user2',
    username: 'admin_user',
    email: 'admin@example.com',
    passwordHash: 'hashed_admin_password',
    role: 'admin',
    createdAt: '2024-01-01',
    internalNotes: 'System administrator',
    apiKey: 'admin-secret-api-key'
  },
  user3: {
    id: 'user3',
    username: 'jane_smith',
    email: 'jane@example.com',
    passwordHash: 'hashed_password_456',
    role: 'user',
    createdAt: '2024-02-20',
    internalNotes: 'Regular user',
    apiKey: 'jane-secret-api-key'
  }
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Helper function to strip sensitive fields
const stripSensitiveFields = (user, requestingUser) => {
  const { passwordHash, apiKey, internalNotes, ...safeUser } = user;

  // Admins can see internal notes, but not passwords or API keys
  if (requestingUser.role === 'admin') {
    safeUser.internalNotes = user.internalNotes;
  }

  return safeUser;
};

// Route to login and get JWT token
app.post('/login', (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = users[userId];
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token, userId: user.id });
});

// Route to get user account data
app.get('/api/users/:userId', authenticateToken, (req, res) => {
  const requestedUserId = req.params.userId;
  const requestingUser = req.user;

  // Check authorization: user can only access their own data, or admin can access any
  if (requestingUser.id !== requestedUserId && requestingUser.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: You can only access your own data' });
  }

  // Get the requested user
  const requestedUser = users[requestedUserId];
  if (!requestedUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Strip sensitive fields based on permissions
  const safeUser = stripSensitiveFields(requestedUser, requestingUser);

  res.json(safeUser);
});

// Route to get multiple users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
  // Only admins can list all users
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Only admins can list all users' });
  }

  const allUsers = Object.values(users).map((user) => stripSensitiveFields(user, req.user));

  res.json(allUsers);
});

// Route to demonstrate Claude AI integration for security-related queries
app.post('/api/security-analysis', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Only admins can perform security analysis' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const client = new anthropic.Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `As a security expert, please analyze the following user data access query and provide security recommendations: ${query}`
      }
    ]
  });

  const analysis = message.content[0].type === 'text' ? message.content[0].text : 'Unable to analyze';

  res.json({
    query,
    analysis,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nExample usage:');
  console.log('1. Login: POST /login with body: {"userId": "user1"}');
  console.log('2. Get own data: GET /api/users/user1 with Bearer token');
  console.log('3. Get admin access: Login as user2 (admin) to access any user data');
  console.log('4. Security analysis: POST /api/security-analysis with admin token');
});